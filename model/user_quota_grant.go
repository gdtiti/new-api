package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	UserQuotaGrantStatusActive    = "active"
	UserQuotaGrantStatusExhausted = "exhausted"
	UserQuotaGrantStatusExpired   = "expired"
	UserQuotaGrantStatusCancelled = "cancelled"
)

const (
	UserQuotaGrantSourceSystem       = "system"
	UserQuotaGrantSourceAdmin        = "admin"
	UserQuotaGrantSourceAdminReplace = "admin_replace"
	UserQuotaGrantSourceTopup        = "topup"
	UserQuotaGrantSourceRedemption   = "redemption"
	UserQuotaGrantSourceCheckin      = "checkin"
	UserQuotaGrantSourceRefund       = "refund"
)

type UserQuotaGrant struct {
	Id              int    `json:"id"`
	UserId          int    `json:"user_id" gorm:"index;index:idx_user_quota_grants_user_status_expire,priority:1"`
	Source          string `json:"source" gorm:"type:varchar(32);index"`
	SourceId        int    `json:"source_id" gorm:"default:0"`
	Note            string `json:"note" gorm:"type:varchar(255);default:''"`
	TotalAmount     int    `json:"total_amount" gorm:"type:int;not null;default:0"`
	RemainingAmount int    `json:"remaining_amount" gorm:"type:int;not null;default:0"`
	EffectiveAt     int64  `json:"effective_at" gorm:"type:bigint;index"`
	ExpireAt        int64  `json:"expire_at" gorm:"type:bigint;index;index:idx_user_quota_grants_user_status_expire,priority:3"`
	Status          string `json:"status" gorm:"type:varchar(32);index;index:idx_user_quota_grants_user_status_expire,priority:2"`
	CreatedAt       int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt       int64  `json:"updated_at" gorm:"bigint"`
}

type UserQuotaAllocation struct {
	GrantId  int   `json:"grant_id"`
	Amount   int   `json:"amount"`
	ExpireAt int64 `json:"expire_at"`
}

func (g *UserQuotaGrant) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	g.CreatedAt = now
	g.UpdatedAt = now
	return nil
}

func (g *UserQuotaGrant) BeforeUpdate(tx *gorm.DB) error {
	g.UpdatedAt = common.GetTimestamp()
	return nil
}

func normalizeQuotaGrantSource(source string) string {
	source = strings.TrimSpace(source)
	if source == "" {
		return UserQuotaGrantSourceSystem
	}
	return source
}

func grantUserQuotaTx(tx *gorm.DB, userId int, quota int, expireAt int64, source string, note string) (int, int64, error) {
	if tx == nil {
		return 0, 0, errors.New("tx is nil")
	}
	if userId <= 0 {
		return 0, 0, errors.New("invalid userId")
	}
	if quota <= 0 {
		return 0, 0, errors.New("quota must be > 0")
	}
	now := GetDBTimestamp()
	if expireAt > 0 && expireAt <= now {
		return 0, 0, errors.New("expireAt must be greater than now")
	}
	grant := &UserQuotaGrant{
		UserId:          userId,
		Source:          normalizeQuotaGrantSource(source),
		Note:            strings.TrimSpace(note),
		TotalAmount:     quota,
		RemainingAmount: quota,
		EffectiveAt:     now,
		ExpireAt:        expireAt,
		Status:          UserQuotaGrantStatusActive,
	}
	if err := tx.Create(grant).Error; err != nil {
		return 0, 0, err
	}
	if err := tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", quota)).Error; err != nil {
		return 0, 0, err
	}
	nextExpireAt, err := getUserQuotaGrantNextExpireAtTx(tx, userId, now)
	if err != nil {
		return 0, 0, err
	}
	var latestQuota int
	if err := tx.Model(&User{}).Where("id = ?", userId).Select("quota").Scan(&latestQuota).Error; err != nil {
		return 0, 0, err
	}
	return latestQuota, nextExpireAt, nil
}

func GrantUserQuota(userId int, quota int, expireAt int64, source string, note string) error {
	if quota < 0 {
		return errors.New("quota 不能为负数！")
	}
	if quota == 0 {
		return nil
	}
	var latestQuota int
	var nextExpireAt int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		latestQuota, nextExpireAt, err = grantUserQuotaTx(tx, userId, quota, expireAt, source, note)
		return err
	})
	if err != nil {
		return err
	}
	syncUserQuotaCacheState(userId, latestQuota, nextExpireAt)
	return nil
}

func ReplaceUserQuota(userId int, target int, source string, note string) error {
	if userId <= 0 {
		return errors.New("invalid userId")
	}
	if target < 0 {
		return errors.New("quota 不能为负数！")
	}
	var nextExpireAt int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&UserQuotaGrant{}).
			Where("user_id = ? AND status IN ?", userId, []string{UserQuotaGrantStatusActive, UserQuotaGrantStatusExhausted}).
			Updates(map[string]interface{}{
				"remaining_amount": 0,
				"status":           UserQuotaGrantStatusCancelled,
				"updated_at":       common.GetTimestamp(),
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", userId).Update("quota", 0).Error; err != nil {
			return err
		}
		nextExpireAt = 0
		if target > 0 {
			_, nextExpireAtInner, err := grantUserQuotaTx(tx, userId, target, 0, source, note)
			if err != nil {
				return err
			}
			nextExpireAt = nextExpireAtInner
		}
		if target == 0 {
			nextExpireAt = 0
		}
		return nil
	})
	if err != nil {
		return err
	}
	syncUserQuotaCacheState(userId, target, nextExpireAt)
	return nil
}

func syncUserQuotaByGrantsTx(tx *gorm.DB, userId int, now int64) (int, int64, error) {
	if tx == nil {
		return 0, 0, errors.New("tx is nil")
	}
	if userId <= 0 {
		return 0, 0, errors.New("invalid userId")
	}
	if now <= 0 {
		now = GetDBTimestamp()
	}
	if err := tx.Model(&UserQuotaGrant{}).
		Where("user_id = ? AND status = ? AND expire_at > 0 AND expire_at <= ?", userId, UserQuotaGrantStatusActive, now).
		Updates(map[string]interface{}{
			"status":     UserQuotaGrantStatusExpired,
			"updated_at": common.GetTimestamp(),
		}).Error; err != nil {
		return 0, 0, err
	}
	var quota int
	if err := tx.Model(&UserQuotaGrant{}).
		Where("user_id = ? AND status = ? AND remaining_amount > 0 AND effective_at <= ? AND (expire_at = 0 OR expire_at > ?)",
			userId, UserQuotaGrantStatusActive, now, now).
		Select("COALESCE(SUM(remaining_amount), 0)").
		Scan(&quota).Error; err != nil {
		return 0, 0, err
	}
	if err := tx.Model(&User{}).Where("id = ?", userId).Update("quota", quota).Error; err != nil {
		return 0, 0, err
	}
	nextExpireAt, err := getUserQuotaGrantNextExpireAtTx(tx, userId, now)
	if err != nil {
		return 0, 0, err
	}
	return quota, nextExpireAt, nil
}

func getUserQuotaGrantNextExpireAtTx(tx *gorm.DB, userId int, now int64) (int64, error) {
	if tx == nil {
		return 0, errors.New("tx is nil")
	}
	if now <= 0 {
		now = GetDBTimestamp()
	}
	var nextExpireAt int64
	if err := tx.Model(&UserQuotaGrant{}).
		Where("user_id = ? AND status = ? AND remaining_amount > 0 AND effective_at <= ? AND expire_at > ?",
			userId, UserQuotaGrantStatusActive, now, now).
		Order("expire_at asc, id asc").
		Limit(1).
		Select("expire_at").
		Scan(&nextExpireAt).Error; err != nil {
		return 0, err
	}
	return nextExpireAt, nil
}

func consumeUserQuotaTx(tx *gorm.DB, userId int, amount int, now int64) ([]UserQuotaAllocation, int, int64, error) {
	if tx == nil {
		return nil, 0, 0, errors.New("tx is nil")
	}
	if userId <= 0 {
		return nil, 0, 0, errors.New("invalid userId")
	}
	if amount <= 0 {
		quota, nextExpireAt, err := syncUserQuotaByGrantsTx(tx, userId, now)
		return []UserQuotaAllocation{}, quota, nextExpireAt, err
	}
	quota, _, err := syncUserQuotaByGrantsTx(tx, userId, now)
	if err != nil {
		return nil, 0, 0, err
	}
	if quota < amount {
		return nil, 0, 0, fmt.Errorf("quota insufficient: need=%d remain=%d", amount, quota)
	}
	var grants []UserQuotaGrant
	if err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("user_id = ? AND status = ? AND remaining_amount > 0 AND effective_at <= ? AND (expire_at = 0 OR expire_at > ?)",
			userId, UserQuotaGrantStatusActive, now, now).
		Order("CASE WHEN expire_at = 0 THEN 1 ELSE 0 END asc, expire_at asc, effective_at asc, id asc").
		Find(&grants).Error; err != nil {
		return nil, 0, 0, err
	}
	remain := amount
	allocations := make([]UserQuotaAllocation, 0, len(grants))
	for _, grant := range grants {
		if remain <= 0 {
			break
		}
		consume := grant.RemainingAmount
		if consume > remain {
			consume = remain
		}
		grant.RemainingAmount -= consume
		grant.Status = UserQuotaGrantStatusActive
		if grant.RemainingAmount == 0 {
			grant.Status = UserQuotaGrantStatusExhausted
		}
		if err := tx.Model(&UserQuotaGrant{}).Where("id = ?", grant.Id).Updates(map[string]interface{}{
			"remaining_amount": grant.RemainingAmount,
			"status":           grant.Status,
			"updated_at":       common.GetTimestamp(),
		}).Error; err != nil {
			return nil, 0, 0, err
		}
		allocations = append(allocations, UserQuotaAllocation{
			GrantId:  grant.Id,
			Amount:   consume,
			ExpireAt: grant.ExpireAt,
		})
		remain -= consume
	}
	if remain > 0 {
		return nil, 0, 0, errors.New("quota insufficient")
	}
	if err := tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota - ?", amount)).Error; err != nil {
		return nil, 0, 0, err
	}
	nextExpireAt, err := getUserQuotaGrantNextExpireAtTx(tx, userId, now)
	if err != nil {
		return nil, 0, 0, err
	}
	return allocations, quota - amount, nextExpireAt, nil
}

func ConsumeUserQuota(userId int, amount int) ([]UserQuotaAllocation, error) {
	if amount < 0 {
		return nil, errors.New("quota 不能为负数！")
	}
	if amount == 0 {
		return []UserQuotaAllocation{}, nil
	}
	var allocations []UserQuotaAllocation
	var latestQuota int
	var nextExpireAt int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		allocations, latestQuota, nextExpireAt, err = consumeUserQuotaTx(tx, userId, amount, GetDBTimestamp())
		return err
	})
	if err != nil {
		return nil, err
	}
	syncUserQuotaCacheState(userId, latestQuota, nextExpireAt)
	return allocations, nil
}

func restoreUserQuotaAllocationsTx(tx *gorm.DB, userId int, allocations []UserQuotaAllocation, now int64) (int, int64, int, error) {
	if tx == nil {
		return 0, 0, 0, errors.New("tx is nil")
	}
	if userId <= 0 {
		return 0, 0, 0, errors.New("invalid userId")
	}
	if len(allocations) == 0 {
		quota, nextExpireAt, err := syncUserQuotaByGrantsTx(tx, userId, now)
		return quota, nextExpireAt, 0, err
	}
	restoredTotal := 0
	for _, allocation := range allocations {
		if allocation.GrantId <= 0 || allocation.Amount <= 0 {
			continue
		}
		var grant UserQuotaGrant
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ? AND user_id = ?", allocation.GrantId, userId).
			First(&grant).Error; err != nil {
			return 0, 0, 0, err
		}
		if grant.ExpireAt > 0 && grant.ExpireAt <= now {
			continue
		}
		restorable := allocation.Amount
		if grant.TotalAmount > 0 && grant.RemainingAmount+restorable > grant.TotalAmount {
			restorable = grant.TotalAmount - grant.RemainingAmount
		}
		if restorable <= 0 {
			continue
		}
		grant.RemainingAmount += restorable
		grant.Status = UserQuotaGrantStatusActive
		if err := tx.Model(&UserQuotaGrant{}).Where("id = ?", grant.Id).Updates(map[string]interface{}{
			"remaining_amount": grant.RemainingAmount,
			"status":           grant.Status,
			"updated_at":       common.GetTimestamp(),
		}).Error; err != nil {
			return 0, 0, 0, err
		}
		restoredTotal += restorable
	}
	if restoredTotal > 0 {
		if err := tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", restoredTotal)).Error; err != nil {
			return 0, 0, 0, err
		}
	}
	quota, nextExpireAt, err := syncUserQuotaByGrantsTx(tx, userId, now)
	if err != nil {
		return 0, 0, 0, err
	}
	return quota, nextExpireAt, restoredTotal, nil
}

func RestoreUserQuotaAllocations(userId int, allocations []UserQuotaAllocation) (int, error) {
	if len(allocations) == 0 {
		return 0, nil
	}
	var restoredTotal int
	var latestQuota int
	var nextExpireAt int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		latestQuota, nextExpireAt, restoredTotal, err = restoreUserQuotaAllocationsTx(tx, userId, allocations, GetDBTimestamp())
		return err
	})
	if err != nil {
		return 0, err
	}
	syncUserQuotaCacheState(userId, latestQuota, nextExpireAt)
	return restoredTotal, nil
}
