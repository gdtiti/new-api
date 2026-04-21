package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm"
)

type CreateTemporaryUserRequest struct {
	Username            string `json:"username"`
	Password            string `json:"password"`
	DisplayName         string `json:"display_name"`
	Remark              string `json:"remark"`
	InitialQuota        int    `json:"initial_quota"`
	UserGroup           string `json:"user_group"`
	TokenGroup          string `json:"token_group"`
	TokenName           string `json:"token_name"`
	TokenExpiredTime    *int64 `json:"token_expired_time,omitempty"`
	TokenUnlimitedQuota *bool  `json:"token_unlimited_quota,omitempty"`
	TokenRemainQuota    *int   `json:"token_remain_quota,omitempty"`
}

type CreateTemporaryUserResult struct {
	UserId              int    `json:"user_id"`
	Username            string `json:"username"`
	Password            string `json:"password"`
	DisplayName         string `json:"display_name"`
	Group               string `json:"group"`
	Quota               int    `json:"quota"`
	DefaultTokenId      int    `json:"default_token_id"`
	DefaultToken        string `json:"default_token"`
	TokenGroup          string `json:"token_group"`
	TokenUnlimitedQuota bool   `json:"token_unlimited_quota"`
	TokenRemainQuota    int    `json:"token_remain_quota"`
	TokenExpiredTime    int64  `json:"token_expired_time"`
}

func CreateTemporaryUser(operatorId int, req CreateTemporaryUserRequest) (*CreateTemporaryUserResult, error) {
	if operatorId <= 0 {
		return nil, errors.New("无效的管理员 ID")
	}

	username := strings.TrimSpace(req.Username)
	var err error
	if username == "" {
		username, err = generateTemporaryUsername()
		if err != nil {
			return nil, err
		}
	}

	password := req.Password
	if password == "" {
		password, err = common.GenerateRandomCharsKey(12)
		if err != nil {
			return nil, fmt.Errorf("生成临时账号密码失败: %w", err)
		}
	}

	userGroup := strings.TrimSpace(req.UserGroup)
	if userGroup == "" {
		userGroup = "default"
	}
	if err := validateTemporaryUserGroup(userGroup); err != nil {
		return nil, err
	}

	tokenGroup := strings.TrimSpace(req.TokenGroup)
	if tokenGroup == "" {
		tokenGroup = userGroup
	}
	if err := validateTemporaryTokenGroup(tokenGroup); err != nil {
		return nil, err
	}

	if req.InitialQuota < 0 {
		return nil, errors.New("初始额度不能为负数")
	}

	tokenUnlimitedQuota := true
	if req.TokenUnlimitedQuota != nil {
		tokenUnlimitedQuota = *req.TokenUnlimitedQuota
	}
	tokenRemainQuota := 0
	if req.TokenRemainQuota != nil {
		tokenRemainQuota = *req.TokenRemainQuota
	}
	if tokenRemainQuota < 0 {
		return nil, errors.New("默认令牌额度不能为负数")
	}

	tokenExpiredTime := int64(-1)
	if req.TokenExpiredTime != nil {
		tokenExpiredTime = *req.TokenExpiredTime
		if tokenExpiredTime == 0 {
			tokenExpiredTime = -1
		}
	}

	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		displayName = username
	}
	tokenName := strings.TrimSpace(req.TokenName)
	if tokenName == "" {
		tokenName = "temporary-default"
	}
	if len(tokenName) > 50 {
		return nil, errors.New("默认令牌名称长度不能超过 50")
	}

	user := &model.User{
		Username:           username,
		Password:           password,
		DisplayName:        displayName,
		Role:               common.RoleCommonUser,
		Status:             common.UserStatusEnabled,
		Group:              userGroup,
		Remark:             strings.TrimSpace(req.Remark),
		IsTemporary:        true,
		TemporaryCreatedBy: operatorId,
	}
	if err := common.Validate.Struct(user); err != nil {
		return nil, fmt.Errorf("临时账号参数无效: %w", err)
	}

	tokenKey, err := common.GenerateKey()
	if err != nil {
		return nil, fmt.Errorf("生成默认令牌失败: %w", err)
	}
	now := common.GetTimestamp()
	token := &model.Token{
		Name:            tokenName,
		Key:             tokenKey,
		Status:          common.TokenStatusEnabled,
		CreatedTime:     now,
		AccessedTime:    now,
		ExpiredTime:     tokenExpiredTime,
		RemainQuota:     tokenRemainQuota,
		UnlimitedQuota:  tokenUnlimitedQuota,
		Group:           tokenGroup,
		CrossGroupRetry: false,
	}

	err = model.DB.Transaction(func(tx *gorm.DB) error {
		if err := user.InsertWithTx(tx, 0); err != nil {
			return err
		}

		token.UserId = user.Id
		if err := tx.Create(token).Error; err != nil {
			return err
		}

		if err := tx.Model(&model.User{}).Where("id = ?", user.Id).Updates(map[string]interface{}{
			"quota":                      req.InitialQuota,
			"temporary_default_token_id": token.Id,
		}).Error; err != nil {
			return err
		}
		user.Quota = req.InitialQuota
		user.TemporaryDefaultTokenId = token.Id
		return nil
	})
	if err != nil {
		return nil, normalizeTemporaryUserCreateError(err)
	}

	model.RecordLog(operatorId, model.LogTypeManage, fmt.Sprintf("管理员开通临时账号 %s", user.Username))
	return &CreateTemporaryUserResult{
		UserId:              user.Id,
		Username:            user.Username,
		Password:            password,
		DisplayName:         user.DisplayName,
		Group:               user.Group,
		Quota:               user.Quota,
		DefaultTokenId:      token.Id,
		DefaultToken:        token.Key,
		TokenGroup:          token.Group,
		TokenUnlimitedQuota: token.UnlimitedQuota,
		TokenRemainQuota:    token.RemainQuota,
		TokenExpiredTime:    token.ExpiredTime,
	}, nil
}

func validateTemporaryUserGroup(group string) error {
	if group == "" {
		return errors.New("用户分组不能为空")
	}
	if _, ok := ratio_setting.GetGroupRatioCopy()[group]; ok {
		return nil
	}
	return fmt.Errorf("用户分组不存在: %s", group)
}

func validateTemporaryTokenGroup(group string) error {
	if group == "" {
		return errors.New("令牌分组不能为空")
	}
	if group == "auto" {
		return nil
	}
	if _, ok := ratio_setting.GetGroupRatioCopy()[group]; ok {
		return nil
	}
	return fmt.Errorf("令牌分组不存在: %s", group)
}

func generateTemporaryUsername() (string, error) {
	for i := 0; i < 10; i++ {
		candidate := fmt.Sprintf("temp_%s", strings.ToLower(common.GetRandomString(8)))
		var count int64
		if err := model.DB.Model(&model.User{}).Where("username = ?", candidate).Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
	}
	return "", errors.New("生成临时账号用户名失败，请重试")
}

func normalizeTemporaryUserCreateError(err error) error {
	if err == nil {
		return nil
	}
	lowerErr := strings.ToLower(err.Error())
	if strings.Contains(lowerErr, "unique") || strings.Contains(lowerErr, "duplicate") {
		return errors.New("临时账号用户名或默认令牌已存在，请重试")
	}
	return err
}
