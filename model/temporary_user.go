package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type TemporaryUserListItem struct {
	Id                         int    `json:"id"`
	Username                   string `json:"username"`
	DisplayName                string `json:"display_name"`
	Status                     int    `json:"status"`
	Quota                      int    `json:"quota"`
	Group                      string `json:"group"`
	Remark                     string `json:"remark"`
	TemporaryCreatedBy         int    `json:"temporary_created_by"`
	TemporaryCreatorName       string `json:"temporary_creator_name"`
	DefaultTokenId             int    `json:"default_token_id"`
	DefaultTokenMasked         string `json:"default_token_masked"`
	DefaultTokenStatus         int    `json:"default_token_status"`
	DefaultTokenGroup          string `json:"default_token_group"`
	DefaultTokenRemainQuota    int    `json:"default_token_remain_quota"`
	DefaultTokenUnlimitedQuota bool   `json:"default_token_unlimited_quota"`
	DefaultTokenExpiredTime    int64  `json:"default_token_expired_time"`
	OpenedTime                 int64  `json:"opened_time"`
}

func GetTemporaryUsersPage(startIdx int, num int) (items []*TemporaryUserListItem, total int64, err error) {
	tx := DB.Model(&User{}).Where("is_temporary = ?", true)
	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var users []*User
	if err = tx.Omit("password").Order("id desc").Limit(num).Offset(startIdx).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	creatorIDs := make([]int, 0, len(users))
	tokenIDs := make([]int, 0, len(users))
	creatorSeen := make(map[int]struct{}, len(users))
	tokenSeen := make(map[int]struct{}, len(users))
	for _, user := range users {
		if user == nil {
			continue
		}
		if user.TemporaryCreatedBy > 0 {
			if _, ok := creatorSeen[user.TemporaryCreatedBy]; !ok {
				creatorSeen[user.TemporaryCreatedBy] = struct{}{}
				creatorIDs = append(creatorIDs, user.TemporaryCreatedBy)
			}
		}
		if user.TemporaryDefaultTokenId > 0 {
			if _, ok := tokenSeen[user.TemporaryDefaultTokenId]; !ok {
				tokenSeen[user.TemporaryDefaultTokenId] = struct{}{}
				tokenIDs = append(tokenIDs, user.TemporaryDefaultTokenId)
			}
		}
	}

	creatorNames, err := loadUsernamesByIDs(creatorIDs)
	if err != nil {
		return nil, 0, err
	}
	tokenMap, err := loadTokensByIDs(tokenIDs)
	if err != nil {
		return nil, 0, err
	}

	items = make([]*TemporaryUserListItem, 0, len(users))
	for _, user := range users {
		if user == nil {
			continue
		}
		item := &TemporaryUserListItem{
			Id:                   user.Id,
			Username:             user.Username,
			DisplayName:          user.DisplayName,
			Status:               user.Status,
			Quota:                user.Quota,
			Group:                user.Group,
			Remark:               user.Remark,
			TemporaryCreatedBy:   user.TemporaryCreatedBy,
			TemporaryCreatorName: creatorNames[user.TemporaryCreatedBy],
			DefaultTokenId:       user.TemporaryDefaultTokenId,
		}
		if token, ok := tokenMap[user.TemporaryDefaultTokenId]; ok && token != nil {
			item.DefaultTokenMasked = token.GetMaskedKey()
			item.DefaultTokenStatus = token.Status
			item.DefaultTokenGroup = token.Group
			item.DefaultTokenRemainQuota = token.RemainQuota
			item.DefaultTokenUnlimitedQuota = token.UnlimitedQuota
			item.DefaultTokenExpiredTime = token.ExpiredTime
			item.OpenedTime = token.CreatedTime
		}
		items = append(items, item)
	}
	return items, total, nil
}

func SetTemporaryUserAvailability(userId int, enabled bool) error {
	_, err := updateTemporaryUserAvailability(userId, enabled, true)
	return err
}

func DisableTemporaryUserAndDefaultToken(userId int) (bool, error) {
	return updateTemporaryUserAvailability(userId, false, false)
}

func updateTemporaryUserAvailability(userId int, enabled bool, rejectNonTemporary bool) (bool, error) {
	if userId <= 0 {
		return false, errors.New("无效的用户 ID")
	}

	var (
		user  *User
		token *Token
	)
	err := DB.Transaction(func(tx *gorm.DB) error {
		currentUser := &User{}
		if err := tx.Where("id = ?", userId).First(currentUser).Error; err != nil {
			return err
		}
		if !currentUser.IsTemporary {
			if rejectNonTemporary {
				return errors.New("目标用户不是临时账号")
			}
			return nil
		}

		userStatus := common.UserStatusDisabled
		tokenStatus := common.TokenStatusDisabled
		if enabled {
			userStatus = common.UserStatusEnabled
			tokenStatus = common.TokenStatusEnabled
		}
		if currentUser.Status != userStatus {
			if err := tx.Model(&User{}).Where("id = ?", currentUser.Id).Update("status", userStatus).Error; err != nil {
				return err
			}
			currentUser.Status = userStatus
		}

		var defaultToken *Token
		if currentUser.TemporaryDefaultTokenId > 0 {
			defaultToken = &Token{}
			err := tx.Where("id = ?", currentUser.TemporaryDefaultTokenId).First(defaultToken).Error
			if err != nil {
				if !errors.Is(err, gorm.ErrRecordNotFound) {
					return err
				}
				defaultToken = nil
			} else if defaultToken.Status != tokenStatus {
				if err := tx.Model(&Token{}).Where("id = ?", defaultToken.Id).Update("status", tokenStatus).Error; err != nil {
					return err
				}
				defaultToken.Status = tokenStatus
			}
		}

		user = currentUser
		token = defaultToken
		return nil
	})
	if err != nil {
		return false, err
	}
	if user == nil {
		return false, nil
	}
	if err := updateUserCache(*user); err != nil {
		common.SysLog("failed to update temporary user cache: " + err.Error())
	}
	if token != nil {
		if err := cacheSetToken(*token); err != nil {
			common.SysLog("failed to update temporary token cache: " + err.Error())
		}
	}
	return true, nil
}

func loadUsernamesByIDs(ids []int) (map[int]string, error) {
	result := make(map[int]string, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	var users []*User
	if err := DB.Model(&User{}).Select("id", "username").Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, err
	}
	for _, user := range users {
		if user == nil {
			continue
		}
		result[user.Id] = user.Username
	}
	return result, nil
}

func loadTokensByIDs(ids []int) (map[int]*Token, error) {
	result := make(map[int]*Token, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	var tokens []*Token
	if err := DB.Where("id IN ?", ids).Find(&tokens).Error; err != nil {
		return nil, err
	}
	for _, token := range tokens {
		if token == nil {
			continue
		}
		result[token.Id] = token
	}
	return result, nil
}
