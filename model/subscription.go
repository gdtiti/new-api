package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/cachex"
	"github.com/samber/hot"
	"gorm.io/gorm"
)

// Subscription duration units
const (
	SubscriptionDurationYear   = "year"
	SubscriptionDurationMonth  = "month"
	SubscriptionDurationDay    = "day"
	SubscriptionDurationHour   = "hour"
	SubscriptionDurationCustom = "custom"
)

// Subscription quota reset period
const (
	SubscriptionResetNever   = "never"
	SubscriptionResetDaily   = "daily"
	SubscriptionResetWeekly  = "weekly"
	SubscriptionResetMonthly = "monthly"
	SubscriptionResetCustom  = "custom"
)

const (
	SubscriptionStatusActive    = "active"
	SubscriptionStatusQueued    = "queued"
	SubscriptionStatusExpired   = "expired"
	SubscriptionStatusCancelled = "cancelled"
)

const (
	SubscriptionActivationModeConcurrent = "concurrent"
	SubscriptionActivationModeStandalone = "standalone"
	SubscriptionActivationModeDependent  = "dependent"
)

var (
	ErrSubscriptionOrderNotFound      = errors.New("subscription order not found")
	ErrSubscriptionOrderStatusInvalid = errors.New("subscription order status invalid")
)

const (
	subscriptionPlanCacheNamespace     = "new-api:subscription_plan:v1"
	subscriptionPlanInfoCacheNamespace = "new-api:subscription_plan_info:v1"
)

var (
	subscriptionPlanCacheOnce     sync.Once
	subscriptionPlanInfoCacheOnce sync.Once
	subscriptionAutoGrantSeq      atomic.Int64

	subscriptionPlanCache     *cachex.HybridCache[SubscriptionPlan]
	subscriptionPlanInfoCache *cachex.HybridCache[SubscriptionPlanInfo]
)

func subscriptionPlanCacheTTL() time.Duration {
	ttlSeconds := common.GetEnvOrDefault("SUBSCRIPTION_PLAN_CACHE_TTL", 300)
	if ttlSeconds <= 0 {
		ttlSeconds = 300
	}
	return time.Duration(ttlSeconds) * time.Second
}

func subscriptionPlanInfoCacheTTL() time.Duration {
	ttlSeconds := common.GetEnvOrDefault("SUBSCRIPTION_PLAN_INFO_CACHE_TTL", 120)
	if ttlSeconds <= 0 {
		ttlSeconds = 120
	}
	return time.Duration(ttlSeconds) * time.Second
}

func subscriptionPlanCacheCapacity() int {
	capacity := common.GetEnvOrDefault("SUBSCRIPTION_PLAN_CACHE_CAP", 5000)
	if capacity <= 0 {
		capacity = 5000
	}
	return capacity
}

func subscriptionPlanInfoCacheCapacity() int {
	capacity := common.GetEnvOrDefault("SUBSCRIPTION_PLAN_INFO_CACHE_CAP", 10000)
	if capacity <= 0 {
		capacity = 10000
	}
	return capacity
}

func getSubscriptionPlanCache() *cachex.HybridCache[SubscriptionPlan] {
	subscriptionPlanCacheOnce.Do(func() {
		ttl := subscriptionPlanCacheTTL()
		subscriptionPlanCache = cachex.NewHybridCache[SubscriptionPlan](cachex.HybridCacheConfig[SubscriptionPlan]{
			Namespace: cachex.Namespace(subscriptionPlanCacheNamespace),
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.JSONCodec[SubscriptionPlan]{},
			Memory: func() *hot.HotCache[string, SubscriptionPlan] {
				return hot.NewHotCache[string, SubscriptionPlan](hot.LRU, subscriptionPlanCacheCapacity()).
					WithTTL(ttl).
					WithJanitor().
					Build()
			},
		})
	})
	return subscriptionPlanCache
}

func getSubscriptionPlanInfoCache() *cachex.HybridCache[SubscriptionPlanInfo] {
	subscriptionPlanInfoCacheOnce.Do(func() {
		ttl := subscriptionPlanInfoCacheTTL()
		subscriptionPlanInfoCache = cachex.NewHybridCache[SubscriptionPlanInfo](cachex.HybridCacheConfig[SubscriptionPlanInfo]{
			Namespace: cachex.Namespace(subscriptionPlanInfoCacheNamespace),
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.JSONCodec[SubscriptionPlanInfo]{},
			Memory: func() *hot.HotCache[string, SubscriptionPlanInfo] {
				return hot.NewHotCache[string, SubscriptionPlanInfo](hot.LRU, subscriptionPlanInfoCacheCapacity()).
					WithTTL(ttl).
					WithJanitor().
					Build()
			},
		})
	})
	return subscriptionPlanInfoCache
}

func subscriptionPlanCacheKey(id int) string {
	if id <= 0 {
		return ""
	}
	return strconv.Itoa(id)
}

func InvalidateSubscriptionPlanCache(planId int) {
	if planId <= 0 {
		return
	}
	cache := getSubscriptionPlanCache()
	_, _ = cache.DeleteMany([]string{subscriptionPlanCacheKey(planId)})
	infoCache := getSubscriptionPlanInfoCache()
	_ = infoCache.Purge()
}

// Subscription plan
type SubscriptionPlan struct {
	Id int `json:"id"`

	Title    string `json:"title" gorm:"type:varchar(128);not null"`
	Subtitle string `json:"subtitle" gorm:"type:varchar(255);default:''"`

	// Display money amount (follow existing code style: float64 for money)
	PriceAmount float64 `json:"price_amount" gorm:"type:decimal(10,6);not null;default:0"`
	Currency    string  `json:"currency" gorm:"type:varchar(8);not null;default:'USD'"`

	DurationUnit  string `json:"duration_unit" gorm:"type:varchar(16);not null;default:'month'"`
	DurationValue int    `json:"duration_value" gorm:"type:int;not null;default:1"`
	CustomSeconds int64  `json:"custom_seconds" gorm:"type:bigint;not null;default:0"`

	Enabled   bool `json:"enabled" gorm:"default:true"`
	SortOrder int  `json:"sort_order" gorm:"type:int;default:0"`

	StripePriceId  string `json:"stripe_price_id" gorm:"type:varchar(128);default:''"`
	CreemProductId string `json:"creem_product_id" gorm:"type:varchar(128);default:''"`

	// Max purchases per user (0 = unlimited)
	MaxPurchasePerUser int `json:"max_purchase_per_user" gorm:"type:int;default:0"`

	AllowStacking     bool   `json:"allow_stacking" gorm:"default:true"`
	AllowContinuation bool   `json:"allow_continuation" gorm:"default:true"`
	ActivationMode    string `json:"activation_mode" gorm:"type:varchar(32);not null;default:'concurrent'"`

	// Upgrade user group after purchase (empty = no change)
	UpgradeGroup string `json:"upgrade_group" gorm:"type:varchar(64);default:''"`

	// Total quota (amount in quota units, 0 = unlimited)
	TotalAmount int64 `json:"total_amount" gorm:"type:bigint;not null;default:0"`

	// Quota reset period for plan
	QuotaResetPeriod        string `json:"quota_reset_period" gorm:"type:varchar(16);default:'never'"`
	QuotaResetCustomSeconds int64  `json:"quota_reset_custom_seconds" gorm:"type:bigint;default:0"`

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

func (p *SubscriptionPlan) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	p.CreatedAt = now
	p.UpdatedAt = now
	return nil
}

func (p *SubscriptionPlan) BeforeUpdate(tx *gorm.DB) error {
	p.UpdatedAt = common.GetTimestamp()
	return nil
}

// Subscription order (payment -> webhook -> create UserSubscription)
type SubscriptionOrder struct {
	Id     int     `json:"id"`
	UserId int     `json:"user_id" gorm:"index"`
	PlanId int     `json:"plan_id" gorm:"index"`
	Money  float64 `json:"money"`

	TradeNo         string `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	PaymentMethod   string `json:"payment_method" gorm:"type:varchar(50)"`
	PaymentProvider string `json:"payment_provider" gorm:"type:varchar(50);default:''"`
	Status          string `json:"status"`
	CreateTime      int64  `json:"create_time"`
	CompleteTime    int64  `json:"complete_time"`

	ProviderPayload string `json:"provider_payload" gorm:"type:text"`
}

func (o *SubscriptionOrder) Insert() error {
	if o.CreateTime == 0 {
		o.CreateTime = common.GetTimestamp()
	}
	return DB.Create(o).Error
}

func (o *SubscriptionOrder) Update() error {
	return DB.Save(o).Error
}

func GetSubscriptionOrderByTradeNo(tradeNo string) *SubscriptionOrder {
	if tradeNo == "" {
		return nil
	}
	var order SubscriptionOrder
	if err := DB.Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
		return nil
	}
	return &order
}

// User subscription instance
type UserSubscription struct {
	Id     int `json:"id"`
	UserId int `json:"user_id" gorm:"index;index:idx_user_sub_active,priority:1;uniqueIndex:idx_user_sub_grant_key,priority:1"`
	PlanId int `json:"plan_id" gorm:"index"`

	AmountTotal int64 `json:"amount_total" gorm:"type:bigint;not null;default:0"`
	AmountUsed  int64 `json:"amount_used" gorm:"type:bigint;not null;default:0"`

	DurationUnit            string `json:"duration_unit" gorm:"type:varchar(16);not null;default:'month'"`
	DurationValue           int    `json:"duration_value" gorm:"type:int;not null;default:1"`
	CustomSeconds           int64  `json:"custom_seconds" gorm:"type:bigint;not null;default:0"`
	QuotaResetPeriod        string `json:"quota_reset_period" gorm:"type:varchar(16);default:'never'"`
	QuotaResetCustomSeconds int64  `json:"quota_reset_custom_seconds" gorm:"type:bigint;default:0"`
	AllowStacking           bool   `json:"allow_stacking" gorm:"default:true"`
	AllowContinuation       bool   `json:"allow_continuation" gorm:"default:true"`
	ActivationMode          string `json:"activation_mode" gorm:"type:varchar(32);not null;default:'concurrent'"`
	PreviousSubscriptionId  int    `json:"previous_subscription_id" gorm:"default:0;index"`
	ActivatedAt             int64  `json:"activated_at" gorm:"type:bigint;default:0"`

	StartTime int64  `json:"start_time" gorm:"bigint"`
	EndTime   int64  `json:"end_time" gorm:"bigint;index;index:idx_user_sub_active,priority:3"`
	Status    string `json:"status" gorm:"type:varchar(32);index;index:idx_user_sub_active,priority:2"` // active/queued/expired/cancelled

	Source   string `json:"source" gorm:"type:varchar(64);default:'order';index"` // order/admin/register_default
	GrantKey string `json:"grant_key,omitempty" gorm:"type:varchar(128);default:'';uniqueIndex:idx_user_sub_grant_key,priority:2"`

	LastResetTime int64 `json:"last_reset_time" gorm:"type:bigint;default:0"`
	NextResetTime int64 `json:"next_reset_time" gorm:"type:bigint;default:0;index"`

	UpgradeGroup  string `json:"upgrade_group" gorm:"type:varchar(64);default:''"`
	PrevUserGroup string `json:"prev_user_group" gorm:"type:varchar(64);default:''"`

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

func (s *UserSubscription) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	s.CreatedAt = now
	s.UpdatedAt = now
	return nil
}

func (s *UserSubscription) BeforeUpdate(tx *gorm.DB) error {
	s.UpdatedAt = common.GetTimestamp()
	return nil
}

type SubscriptionSummary struct {
	Subscription *UserSubscription `json:"subscription"`
}

func calcPlanEndTime(start time.Time, plan *SubscriptionPlan) (int64, error) {
	if plan == nil {
		return 0, errors.New("plan is nil")
	}
	if plan.DurationValue <= 0 && plan.DurationUnit != SubscriptionDurationCustom {
		return 0, errors.New("duration_value must be > 0")
	}
	switch plan.DurationUnit {
	case SubscriptionDurationYear:
		return start.AddDate(plan.DurationValue, 0, 0).Unix(), nil
	case SubscriptionDurationMonth:
		return start.AddDate(0, plan.DurationValue, 0).Unix(), nil
	case SubscriptionDurationDay:
		return start.Add(time.Duration(plan.DurationValue) * 24 * time.Hour).Unix(), nil
	case SubscriptionDurationHour:
		return start.Add(time.Duration(plan.DurationValue) * time.Hour).Unix(), nil
	case SubscriptionDurationCustom:
		if plan.CustomSeconds <= 0 {
			return 0, errors.New("custom_seconds must be > 0")
		}
		return start.Add(time.Duration(plan.CustomSeconds) * time.Second).Unix(), nil
	default:
		return 0, fmt.Errorf("invalid duration_unit: %s", plan.DurationUnit)
	}
}

func NormalizeResetPeriod(period string) string {
	switch strings.TrimSpace(period) {
	case SubscriptionResetDaily, SubscriptionResetWeekly, SubscriptionResetMonthly, SubscriptionResetCustom:
		return strings.TrimSpace(period)
	default:
		return SubscriptionResetNever
	}
}

func NormalizeActivationMode(mode string) string {
	switch strings.TrimSpace(mode) {
	case SubscriptionActivationModeStandalone, SubscriptionActivationModeDependent:
		return strings.TrimSpace(mode)
	default:
		return SubscriptionActivationModeConcurrent
	}
}

func buildSubscriptionSnapshotPlan(sub *UserSubscription) *SubscriptionPlan {
	if sub == nil {
		return nil
	}
	return &SubscriptionPlan{
		DurationUnit:            sub.DurationUnit,
		DurationValue:           sub.DurationValue,
		CustomSeconds:           sub.CustomSeconds,
		QuotaResetPeriod:        sub.QuotaResetPeriod,
		QuotaResetCustomSeconds: sub.QuotaResetCustomSeconds,
		UpgradeGroup:            sub.UpgradeGroup,
		AllowStacking:           sub.AllowStacking,
		AllowContinuation:       sub.AllowContinuation,
		ActivationMode:          sub.ActivationMode,
		TotalAmount:             sub.AmountTotal,
	}
}

func calcNextResetTime(base time.Time, plan *SubscriptionPlan, endUnix int64) int64 {
	if plan == nil {
		return 0
	}
	period := NormalizeResetPeriod(plan.QuotaResetPeriod)
	if period == SubscriptionResetNever {
		return 0
	}
	var next time.Time
	switch period {
	case SubscriptionResetDaily:
		next = time.Date(base.Year(), base.Month(), base.Day(), 0, 0, 0, 0, base.Location()).
			AddDate(0, 0, 1)
	case SubscriptionResetWeekly:
		// Align to next Monday 00:00
		weekday := int(base.Weekday()) // Sunday=0
		// Convert to Monday=1..Sunday=7
		if weekday == 0 {
			weekday = 7
		}
		daysUntil := 8 - weekday
		next = time.Date(base.Year(), base.Month(), base.Day(), 0, 0, 0, 0, base.Location()).
			AddDate(0, 0, daysUntil)
	case SubscriptionResetMonthly:
		// Align to first day of next month 00:00
		next = time.Date(base.Year(), base.Month(), 1, 0, 0, 0, 0, base.Location()).
			AddDate(0, 1, 0)
	case SubscriptionResetCustom:
		if plan.QuotaResetCustomSeconds <= 0 {
			return 0
		}
		next = base.Add(time.Duration(plan.QuotaResetCustomSeconds) * time.Second)
	default:
		return 0
	}
	if endUnix > 0 && next.Unix() > endUnix {
		return 0
	}
	return next.Unix()
}

func GetSubscriptionPlanById(id int) (*SubscriptionPlan, error) {
	return getSubscriptionPlanByIdTx(nil, id)
}

func getSubscriptionPlanByIdTx(tx *gorm.DB, id int) (*SubscriptionPlan, error) {
	if id <= 0 {
		return nil, errors.New("invalid plan id")
	}
	key := subscriptionPlanCacheKey(id)
	if key != "" {
		if cached, found, err := getSubscriptionPlanCache().Get(key); err == nil && found {
			return &cached, nil
		}
	}
	var plan SubscriptionPlan
	query := DB
	if tx != nil {
		query = tx
	}
	if err := query.Where("id = ?", id).First(&plan).Error; err != nil {
		return nil, err
	}
	_ = getSubscriptionPlanCache().SetWithTTL(key, plan, subscriptionPlanCacheTTL())
	return &plan, nil
}

func CountUserSubscriptionsByPlan(userId int, planId int) (int64, error) {
	if userId <= 0 || planId <= 0 {
		return 0, errors.New("invalid userId or planId")
	}
	var count int64
	if err := DB.Model(&UserSubscription{}).
		Where("user_id = ? AND plan_id = ?", userId, planId).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func getUserGroupByIdTx(tx *gorm.DB, userId int) (string, error) {
	if userId <= 0 {
		return "", errors.New("invalid userId")
	}
	if tx == nil {
		tx = DB
	}
	var group string
	if err := tx.Model(&User{}).Where("id = ?", userId).Select(commonGroupCol).Find(&group).Error; err != nil {
		return "", err
	}
	return group, nil
}

func downgradeUserGroupForSubscriptionTx(tx *gorm.DB, sub *UserSubscription, now int64) (string, error) {
	if tx == nil || sub == nil {
		return "", errors.New("invalid downgrade args")
	}
	upgradeGroup := strings.TrimSpace(sub.UpgradeGroup)
	if upgradeGroup == "" {
		return "", nil
	}
	currentGroup, err := getUserGroupByIdTx(tx, sub.UserId)
	if err != nil {
		return "", err
	}
	if currentGroup != upgradeGroup {
		return "", nil
	}
	var activeSub UserSubscription
	activeQuery := tx.Where("user_id = ? AND status = ? AND end_time > ? AND id <> ? AND upgrade_group <> ''",
		sub.UserId, SubscriptionStatusActive, now, sub.Id).
		Order("end_time desc, id desc").
		Limit(1).
		Find(&activeSub)
	if activeQuery.Error == nil && activeQuery.RowsAffected > 0 {
		return "", nil
	}
	prevGroup := strings.TrimSpace(sub.PrevUserGroup)
	if prevGroup == "" || prevGroup == currentGroup {
		return "", nil
	}
	if err := tx.Model(&User{}).Where("id = ?", sub.UserId).
		Update("group", prevGroup).Error; err != nil {
		return "", err
	}
	return prevGroup, nil
}

func getLatestSamePlanSubscriptionTx(tx *gorm.DB, userId int, planId int, now int64) (*UserSubscription, error) {
	var sub UserSubscription
	query := tx.
		Where("user_id = ? AND plan_id = ? AND status IN ? AND end_time > ?", userId, planId, []string{SubscriptionStatusActive, SubscriptionStatusQueued}, now).
		Order("end_time desc, id desc").
		Limit(1).
		Find(&sub)
	if query.Error != nil {
		return nil, query.Error
	}
	if query.RowsAffected == 0 {
		return nil, nil
	}
	return &sub, nil
}

func getLatestBlockingSubscriptionTx(tx *gorm.DB, userId int, now int64) (*UserSubscription, error) {
	var sub UserSubscription
	query := tx.
		Where("user_id = ? AND status IN ? AND end_time > ?", userId, []string{SubscriptionStatusActive, SubscriptionStatusQueued}, now).
		Order("end_time desc, id desc").
		Limit(1).
		Find(&sub)
	if query.Error != nil {
		return nil, query.Error
	}
	if query.RowsAffected == 0 {
		return nil, nil
	}
	return &sub, nil
}

func getDependentAnchorSubscriptionTx(tx *gorm.DB, userId int, now int64) (*UserSubscription, error) {
	var sub UserSubscription
	query := tx.
		Where("user_id = ? AND status IN ? AND end_time > ? AND activation_mode <> ?", userId, []string{SubscriptionStatusActive, SubscriptionStatusQueued}, now, SubscriptionActivationModeDependent).
		Order("CASE WHEN status = 'active' THEN 0 ELSE 1 END asc, start_time asc, id asc").
		Limit(1).
		Find(&sub)
	if query.Error != nil {
		return nil, query.Error
	}
	if query.RowsAffected == 0 {
		return nil, nil
	}
	return &sub, nil
}

func initSubscriptionResetState(sub *UserSubscription, plan *SubscriptionPlan, nowUnix int64) {
	if sub == nil || plan == nil {
		return
	}
	sub.LastResetTime = 0
	sub.NextResetTime = 0
	if NormalizeResetPeriod(plan.QuotaResetPeriod) == SubscriptionResetNever {
		return
	}
	base := time.Unix(nowUnix, 0)
	nextReset := calcNextResetTime(base, plan, sub.EndTime)
	if nextReset > 0 {
		sub.LastResetTime = nowUnix
		sub.NextResetTime = nextReset
	}
}

func applyPlanRuntimeSettingsToSubscription(sub *UserSubscription, plan *SubscriptionPlan, nowUnix int64) {
	if sub == nil || plan == nil {
		return
	}
	previousResetPeriod := NormalizeResetPeriod(sub.QuotaResetPeriod)
	previousResetCustomSeconds := sub.QuotaResetCustomSeconds

	sub.AmountTotal = plan.TotalAmount
	sub.QuotaResetPeriod = plan.QuotaResetPeriod
	sub.QuotaResetCustomSeconds = plan.QuotaResetCustomSeconds
	sub.AllowStacking = plan.AllowStacking
	sub.AllowContinuation = plan.AllowContinuation
	sub.ActivationMode = NormalizeActivationMode(plan.ActivationMode)
	sub.UpgradeGroup = strings.TrimSpace(plan.UpgradeGroup)

	if sub.Status != SubscriptionStatusActive {
		sub.LastResetTime = 0
		sub.NextResetTime = 0
		return
	}
	nextPeriod := NormalizeResetPeriod(plan.QuotaResetPeriod)
	if nextPeriod == SubscriptionResetNever {
		sub.LastResetTime = 0
		sub.NextResetTime = 0
		return
	}
	resetConfigChanged := previousResetPeriod != nextPeriod ||
		previousResetCustomSeconds != plan.QuotaResetCustomSeconds
	if sub.NextResetTime <= 0 || resetConfigChanged {
		sub.LastResetTime = nowUnix
		sub.NextResetTime = calcNextResetTime(time.Unix(nowUnix, 0), plan, sub.EndTime)
	}
}

func syncOpenUserSubscriptionsWithPlanTx(tx *gorm.DB, plan *SubscriptionPlan, now int64) ([]int, error) {
	if tx == nil || plan == nil || plan.Id <= 0 {
		return nil, errors.New("invalid subscription plan sync args")
	}
	plan.QuotaResetPeriod = NormalizeResetPeriod(plan.QuotaResetPeriod)
	plan.ActivationMode = NormalizeActivationMode(plan.ActivationMode)
	plan.UpgradeGroup = strings.TrimSpace(plan.UpgradeGroup)

	var subs []UserSubscription
	if err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("plan_id = ? AND status IN ?", plan.Id, []string{SubscriptionStatusActive, SubscriptionStatusQueued}).
		Order("user_id asc, id asc").
		Find(&subs).Error; err != nil {
		return nil, err
	}
	if len(subs) == 0 {
		return nil, nil
	}
	userSet := make(map[int]struct{})
	for _, candidate := range subs {
		sub := candidate
		applyPlanRuntimeSettingsToSubscription(&sub, plan, now)
		if err := tx.Save(&sub).Error; err != nil {
			return nil, err
		}
		if sub.UserId > 0 {
			userSet[sub.UserId] = struct{}{}
		}
	}
	userIds := make([]int, 0, len(userSet))
	for userId := range userSet {
		userIds = append(userIds, userId)
	}
	return userIds, nil
}

func SyncOpenUserSubscriptionsWithPlanTx(tx *gorm.DB, plan *SubscriptionPlan, now int64) ([]int, error) {
	userIds, err := syncOpenUserSubscriptionsWithPlanTx(tx, plan, now)
	if err != nil {
		return nil, err
	}
	for _, userId := range userIds {
		if err := refreshUserSubscriptionsTx(tx, userId, now); err != nil {
			return nil, err
		}
	}
	return userIds, nil
}

func buildAutoSubscriptionGrantKey(source string, userId int, planId int) string {
	source = strings.TrimSpace(source)
	if source == "" {
		source = "subscription"
	}
	return fmt.Sprintf("%s:%d:%d:%d:%d", source, userId, planId, time.Now().UnixNano(), subscriptionAutoGrantSeq.Add(1))
}

func activateUserSubscriptionTx(tx *gorm.DB, sub *UserSubscription, now int64) error {
	if tx == nil || sub == nil {
		return errors.New("invalid activate args")
	}
	plan := buildSubscriptionSnapshotPlan(sub)
	if plan == nil {
		return errors.New("invalid subscription snapshot")
	}
	sub.Status = SubscriptionStatusActive
	sub.ActivatedAt = now
	initSubscriptionResetState(sub, plan, now)
	upgradeGroup := strings.TrimSpace(sub.UpgradeGroup)
	if upgradeGroup != "" {
		currentGroup, err := getUserGroupByIdTx(tx, sub.UserId)
		if err != nil {
			return err
		}
		if currentGroup != upgradeGroup {
			if strings.TrimSpace(sub.PrevUserGroup) == "" {
				sub.PrevUserGroup = currentGroup
			}
			if err := tx.Model(&User{}).Where("id = ?", sub.UserId).Update("group", upgradeGroup).Error; err != nil {
				return err
			}
		}
	}
	return tx.Save(sub).Error
}

func CreateUserSubscriptionFromPlanTx(tx *gorm.DB, userId int, plan *SubscriptionPlan, source string) (*UserSubscription, error) {
	return createUserSubscriptionFromPlanTx(tx, userId, plan, source, "")
}

func createUserSubscriptionFromPlanTx(tx *gorm.DB, userId int, plan *SubscriptionPlan, source string, grantKey string) (*UserSubscription, error) {
	if tx == nil {
		return nil, errors.New("tx is nil")
	}
	if plan == nil || plan.Id == 0 {
		return nil, errors.New("invalid plan")
	}
	if userId <= 0 {
		return nil, errors.New("invalid user id")
	}
	plan.ActivationMode = NormalizeActivationMode(plan.ActivationMode)
	if plan.MaxPurchasePerUser > 0 {
		var count int64
		if err := tx.Model(&UserSubscription{}).
			Where("user_id = ? AND plan_id = ?", userId, plan.Id).
			Count(&count).Error; err != nil {
			return nil, err
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			return nil, errors.New("已达到该套餐购买上限")
		}
	}
	nowUnix := GetDBTimestamp()
	startUnix := nowUnix
	previousSubscriptionId := 0
	if plan.AllowContinuation {
		latestSamePlan, err := getLatestSamePlanSubscriptionTx(tx, userId, plan.Id, nowUnix)
		if err != nil {
			return nil, err
		}
		if latestSamePlan != nil && latestSamePlan.EndTime > startUnix {
			startUnix = latestSamePlan.EndTime
			previousSubscriptionId = latestSamePlan.Id
		}
	}
	if !plan.AllowStacking || plan.ActivationMode == SubscriptionActivationModeStandalone {
		blocking, err := getLatestBlockingSubscriptionTx(tx, userId, nowUnix)
		if err != nil {
			return nil, err
		}
		if blocking != nil && blocking.EndTime > startUnix {
			if !plan.AllowContinuation {
				return nil, errors.New("该套餐不能与其它套餐同时生效")
			}
			startUnix = blocking.EndTime
			previousSubscriptionId = blocking.Id
		}
	}
	if plan.ActivationMode == SubscriptionActivationModeDependent {
		anchor, err := getDependentAnchorSubscriptionTx(tx, userId, nowUnix)
		if err != nil {
			return nil, err
		}
		if anchor == nil {
			return nil, errors.New("该套餐需要与其它套餐一起生效")
		}
		if anchor.Status == SubscriptionStatusQueued && anchor.StartTime > startUnix {
			startUnix = anchor.StartTime
			previousSubscriptionId = anchor.Id
		}
	}
	startAt := time.Unix(startUnix, 0)
	endUnix, err := calcPlanEndTime(startAt, plan)
	if err != nil {
		return nil, err
	}
	upgradeGroup := strings.TrimSpace(plan.UpgradeGroup)
	prevGroup := ""
	grantKey = strings.TrimSpace(grantKey)
	if grantKey == "" {
		grantKey = buildAutoSubscriptionGrantKey(source, userId, plan.Id)
	}
	status := SubscriptionStatusActive
	activatedAt := nowUnix
	if startUnix > nowUnix {
		status = SubscriptionStatusQueued
		activatedAt = 0
	}
	if status == SubscriptionStatusActive && upgradeGroup != "" {
		currentGroup, err := getUserGroupByIdTx(tx, userId)
		if err != nil {
			return nil, err
		}
		if currentGroup != upgradeGroup {
			prevGroup = currentGroup
			if err := tx.Model(&User{}).Where("id = ?", userId).
				Update("group", upgradeGroup).Error; err != nil {
				return nil, err
			}
		}
	}
	sub := &UserSubscription{
		UserId:                  userId,
		PlanId:                  plan.Id,
		AmountTotal:             plan.TotalAmount,
		AmountUsed:              0,
		DurationUnit:            plan.DurationUnit,
		DurationValue:           plan.DurationValue,
		CustomSeconds:           plan.CustomSeconds,
		QuotaResetPeriod:        plan.QuotaResetPeriod,
		QuotaResetCustomSeconds: plan.QuotaResetCustomSeconds,
		AllowStacking:           plan.AllowStacking,
		AllowContinuation:       plan.AllowContinuation,
		ActivationMode:          plan.ActivationMode,
		PreviousSubscriptionId:  previousSubscriptionId,
		ActivatedAt:             activatedAt,
		StartTime:               startUnix,
		EndTime:                 endUnix,
		Status:                  status,
		Source:                  source,
		GrantKey:                grantKey,
		UpgradeGroup:            upgradeGroup,
		PrevUserGroup:           prevGroup,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	if status == SubscriptionStatusActive {
		initSubscriptionResetState(sub, plan, nowUnix)
	}
	if err := tx.Create(sub).Error; err != nil {
		return nil, err
	}
	return sub, nil
}

// Complete a subscription order (idempotent). Creates a UserSubscription snapshot from the plan.
// expectedPaymentProvider guards against cross-gateway callback attacks (empty skips the check).
// actualPaymentMethod updates the order's PaymentMethod to reflect the real payment type used (empty skips update).
func CompleteSubscriptionOrder(tradeNo string, providerPayload string, expectedPaymentProvider string, actualPaymentMethod string) error {
	if tradeNo == "" {
		return errors.New("tradeNo is empty")
	}
	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}
	var logUserId int
	var logPlanTitle string
	var logMoney float64
	var logPaymentMethod string
	var upgradeGroup string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var order SubscriptionOrder
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(&order).Error; err != nil {
			return ErrSubscriptionOrderNotFound
		}
		if expectedPaymentProvider != "" && order.PaymentProvider != expectedPaymentProvider {
			return ErrPaymentMethodMismatch
		}
		if order.Status == common.TopUpStatusSuccess {
			return nil
		}
		if order.Status != common.TopUpStatusPending {
			return ErrSubscriptionOrderStatusInvalid
		}
		plan, err := GetSubscriptionPlanById(order.PlanId)
		if err != nil {
			return err
		}
		if !plan.Enabled {
			// still allow completion for already purchased orders
		}
		upgradeGroup = strings.TrimSpace(plan.UpgradeGroup)
		_, err = CreateUserSubscriptionFromPlanTx(tx, order.UserId, plan, "order")
		if err != nil {
			return err
		}
		if err := upsertSubscriptionTopUpTx(tx, &order); err != nil {
			return err
		}
		order.Status = common.TopUpStatusSuccess
		order.CompleteTime = common.GetTimestamp()
		if providerPayload != "" {
			order.ProviderPayload = providerPayload
		}
		if actualPaymentMethod != "" && order.PaymentMethod != actualPaymentMethod {
			order.PaymentMethod = actualPaymentMethod
		}
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		logUserId = order.UserId
		logPlanTitle = plan.Title
		logMoney = order.Money
		logPaymentMethod = order.PaymentMethod
		return nil
	})
	if err != nil {
		return err
	}
	if upgradeGroup != "" && logUserId > 0 {
		_ = UpdateUserGroupCache(logUserId, upgradeGroup)
	}
	if logUserId > 0 {
		msg := fmt.Sprintf("订阅购买成功，套餐: %s，支付金额: %.2f，支付方式: %s", logPlanTitle, logMoney, logPaymentMethod)
		RecordLog(logUserId, LogTypeTopup, msg)
	}
	return nil
}

func upsertSubscriptionTopUpTx(tx *gorm.DB, order *SubscriptionOrder) error {
	if tx == nil || order == nil {
		return errors.New("invalid subscription order")
	}
	now := common.GetTimestamp()
	var topup TopUp
	if err := tx.Where("trade_no = ?", order.TradeNo).First(&topup).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			topup = TopUp{
				UserId:        order.UserId,
				Amount:        0,
				Money:         order.Money,
				TradeNo:       order.TradeNo,
				PaymentMethod: order.PaymentMethod,
				CreateTime:    order.CreateTime,
				CompleteTime:  now,
				Status:        common.TopUpStatusSuccess,
			}
			return tx.Create(&topup).Error
		}
		return err
	}
	topup.Money = order.Money
	if topup.PaymentMethod == "" {
		topup.PaymentMethod = order.PaymentMethod
	} else if topup.PaymentMethod != order.PaymentMethod {
		return ErrPaymentMethodMismatch
	}
	if topup.CreateTime == 0 {
		topup.CreateTime = order.CreateTime
	}
	topup.CompleteTime = now
	topup.Status = common.TopUpStatusSuccess
	return tx.Save(&topup).Error
}

func ExpireSubscriptionOrder(tradeNo string, expectedPaymentProvider string) error {
	if tradeNo == "" {
		return errors.New("tradeNo is empty")
	}
	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var order SubscriptionOrder
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(&order).Error; err != nil {
			return ErrSubscriptionOrderNotFound
		}
		if expectedPaymentProvider != "" && order.PaymentProvider != expectedPaymentProvider {
			return ErrPaymentMethodMismatch
		}
		if order.Status != common.TopUpStatusPending {
			return nil
		}
		order.Status = common.TopUpStatusExpired
		order.CompleteTime = common.GetTimestamp()
		return tx.Save(&order).Error
	})
}

// Admin bind (no payment). Creates a UserSubscription from a plan.
func AdminBindSubscription(userId int, planId int, sourceNote string) (string, error) {
	if userId <= 0 || planId <= 0 {
		return "", errors.New("invalid userId or planId")
	}
	plan, err := GetSubscriptionPlanById(planId)
	if err != nil {
		return "", err
	}
	var createdSub *UserSubscription
	err = DB.Transaction(func(tx *gorm.DB) error {
		var innerErr error
		createdSub, innerErr = CreateUserSubscriptionFromPlanTx(tx, userId, plan, "admin")
		return innerErr
	})
	if err != nil {
		return "", err
	}
	if createdSub != nil && createdSub.Status == SubscriptionStatusActive && strings.TrimSpace(plan.UpgradeGroup) != "" {
		_ = UpdateUserGroupCache(userId, plan.UpgradeGroup)
	}
	messages := make([]string, 0, 2)
	if createdSub != nil && createdSub.Status == SubscriptionStatusQueued {
		messages = append(messages, fmt.Sprintf("套餐已排队，将于 %s 生效", time.Unix(createdSub.StartTime, 0).Format("2006-01-02 15:04:05")))
	}
	if createdSub != nil && createdSub.Status == SubscriptionStatusActive && strings.TrimSpace(plan.UpgradeGroup) != "" {
		messages = append(messages, fmt.Sprintf("用户分组将升级到 %s", plan.UpgradeGroup))
	}
	if len(messages) > 0 {
		return strings.Join(messages, "；"), nil
	}
	return "", nil
}

func refreshUserSubscriptionsTx(tx *gorm.DB, userId int, now int64) error {
	if tx == nil {
		return errors.New("tx is nil")
	}
	if userId <= 0 {
		return errors.New("invalid userId")
	}
	var activeSubs []UserSubscription
	if err := tx.Where("user_id = ? AND status = ? AND end_time > 0 AND end_time <= ?", userId, SubscriptionStatusActive, now).
		Order("end_time asc, id asc").
		Find(&activeSubs).Error; err != nil {
		return err
	}
	cacheGroup := ""
	for _, candidate := range activeSubs {
		sub := candidate
		if err := tx.Model(&UserSubscription{}).Where("id = ?", sub.Id).Updates(map[string]interface{}{
			"status":     SubscriptionStatusExpired,
			"updated_at": common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}
		target, err := downgradeUserGroupForSubscriptionTx(tx, &sub, now)
		if err != nil {
			return err
		}
		if target != "" {
			cacheGroup = target
		}
	}
	var overdueQueued []UserSubscription
	if err := tx.Where("user_id = ? AND status = ? AND end_time > 0 AND end_time <= ?", userId, SubscriptionStatusQueued, now).
		Find(&overdueQueued).Error; err != nil {
		return err
	}
	if len(overdueQueued) > 0 {
		if err := tx.Model(&UserSubscription{}).
			Where("user_id = ? AND status = ? AND end_time > 0 AND end_time <= ?", userId, SubscriptionStatusQueued, now).
			Updates(map[string]interface{}{
				"status":     SubscriptionStatusExpired,
				"updated_at": common.GetTimestamp(),
			}).Error; err != nil {
			return err
		}
	}
	var queuedSubs []UserSubscription
	if err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("user_id = ? AND status = ? AND start_time <= ? AND end_time > ?", userId, SubscriptionStatusQueued, now, now).
		Order("start_time asc, id asc").
		Find(&queuedSubs).Error; err != nil {
		return err
	}
	for _, candidate := range queuedSubs {
		sub := candidate
		blocked := false
		switch NormalizeActivationMode(sub.ActivationMode) {
		case SubscriptionActivationModeStandalone:
			var count int64
			if err := tx.Model(&UserSubscription{}).
				Where("user_id = ? AND status = ? AND end_time > ? AND id <> ?", userId, SubscriptionStatusActive, now, sub.Id).
				Count(&count).Error; err != nil {
				return err
			}
			blocked = count > 0
		case SubscriptionActivationModeDependent:
			var count int64
			if err := tx.Model(&UserSubscription{}).
				Where("user_id = ? AND status = ? AND end_time > ? AND id <> ? AND activation_mode <> ?",
					userId, SubscriptionStatusActive, now, sub.Id, SubscriptionActivationModeDependent).
				Count(&count).Error; err != nil {
				return err
			}
			blocked = count == 0
		}
		if blocked {
			continue
		}
		if err := activateUserSubscriptionTx(tx, &sub, now); err != nil {
			return err
		}
		if strings.TrimSpace(sub.UpgradeGroup) != "" {
			cacheGroup = sub.UpgradeGroup
		}
	}
	if cacheGroup != "" {
		_ = UpdateUserGroupCache(userId, cacheGroup)
	}
	return nil
}

func RefreshUserSubscriptions(userId int) error {
	if userId <= 0 {
		return errors.New("invalid userId")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		return refreshUserSubscriptionsTx(tx, userId, GetDBTimestamp())
	})
}

func GrantRegisterDefaultSubscription(userId int) (string, string, error) {
	if userId <= 0 {
		return "failed", "", errors.New("invalid userId")
	}
	if !common.RegisterDefaultSubscriptionEnabled {
		return "skipped", "", nil
	}
	planId := common.RegisterDefaultSubscriptionPlanId
	if planId <= 0 {
		return "failed", "", errors.New("register default subscription plan is not configured")
	}
	source := "register_default"
	grantKey := source
	var upgradeGroup string
	status := "created"
	err := DB.Transaction(func(tx *gorm.DB) error {
		var plan SubscriptionPlan
		if err := tx.Where("id = ?", planId).First(&plan).Error; err != nil {
			return err
		}
		if !plan.Enabled {
			return errors.New("register default subscription plan is disabled")
		}
		var existing UserSubscription
		result := tx.Where("user_id = ? AND grant_key = ?", userId, grantKey).Order("id desc").First(&existing)
		if result.Error == nil {
			status = "already_exists"
			upgradeGroup = strings.TrimSpace(existing.UpgradeGroup)
			return nil
		}
		if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return result.Error
		}
		sub, err := createUserSubscriptionFromPlanTx(tx, userId, &plan, source, grantKey)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
				status = "already_exists"
				return nil
			}
			return err
		}
		upgradeGroup = strings.TrimSpace(sub.UpgradeGroup)
		return nil
	})
	if err != nil {
		return "failed", "", err
	}
	if status == "already_exists" && upgradeGroup == "" {
		var existing UserSubscription
		if err := DB.Where("user_id = ? AND grant_key = ?", userId, grantKey).Order("id desc").First(&existing).Error; err == nil {
			upgradeGroup = strings.TrimSpace(existing.UpgradeGroup)
		}
	}
	if upgradeGroup != "" {
		_ = UpdateUserGroupCache(userId, upgradeGroup)
		return status, fmt.Sprintf("用户分组将升级到 %s", upgradeGroup), nil
	}
	return status, "", nil
}

// GetAllActiveUserSubscriptions returns all active subscriptions for a user.
func GetAllActiveUserSubscriptions(userId int) ([]SubscriptionSummary, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	if err := RefreshUserSubscriptions(userId); err != nil {
		return nil, err
	}
	now := common.GetTimestamp()
	var subs []UserSubscription
	err := DB.Where("user_id = ? AND status = ? AND end_time > ?", userId, SubscriptionStatusActive, now).
		Order("end_time desc, id desc").
		Find(&subs).Error
	if err != nil {
		return nil, err
	}
	return buildSubscriptionSummaries(subs), nil
}

// HasActiveUserSubscription returns whether the user has any active subscription.
// This is a lightweight existence check to avoid heavy pre-consume transactions.
func HasActiveUserSubscription(userId int) (bool, error) {
	if userId <= 0 {
		return false, errors.New("invalid userId")
	}
	if err := RefreshUserSubscriptions(userId); err != nil {
		return false, err
	}
	now := common.GetTimestamp()
	var count int64
	if err := DB.Model(&UserSubscription{}).
		Where("user_id = ? AND status = ? AND end_time > ?", userId, SubscriptionStatusActive, now).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// GetAllUserSubscriptions returns all subscriptions (active and expired) for a user.
func GetAllUserSubscriptions(userId int) ([]SubscriptionSummary, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	if err := RefreshUserSubscriptions(userId); err != nil {
		return nil, err
	}
	var subs []UserSubscription
	err := DB.Where("user_id = ?", userId).
		Order("end_time desc, id desc").
		Find(&subs).Error
	if err != nil {
		return nil, err
	}
	return buildSubscriptionSummaries(subs), nil
}

func buildSubscriptionSummaries(subs []UserSubscription) []SubscriptionSummary {
	if len(subs) == 0 {
		return []SubscriptionSummary{}
	}
	result := make([]SubscriptionSummary, 0, len(subs))
	for _, sub := range subs {
		subCopy := sub
		result = append(result, SubscriptionSummary{
			Subscription: &subCopy,
		})
	}
	return result
}

// AdminInvalidateUserSubscription marks a user subscription as cancelled and ends it immediately.
func AdminInvalidateUserSubscription(userSubscriptionId int) (string, error) {
	if userSubscriptionId <= 0 {
		return "", errors.New("invalid userSubscriptionId")
	}
	now := common.GetTimestamp()
	cacheGroup := ""
	downgradeGroup := ""
	var userId int
	err := DB.Transaction(func(tx *gorm.DB) error {
		var sub UserSubscription
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", userSubscriptionId).First(&sub).Error; err != nil {
			return err
		}
		userId = sub.UserId
		if err := tx.Model(&sub).Updates(map[string]interface{}{
			"status":     SubscriptionStatusCancelled,
			"end_time":   now,
			"updated_at": now,
		}).Error; err != nil {
			return err
		}
		target, err := downgradeUserGroupForSubscriptionTx(tx, &sub, now)
		if err != nil {
			return err
		}
		if target != "" {
			cacheGroup = target
			downgradeGroup = target
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if cacheGroup != "" && userId > 0 {
		_ = UpdateUserGroupCache(userId, cacheGroup)
	}
	if downgradeGroup != "" {
		return fmt.Sprintf("用户分组将回退到 %s", downgradeGroup), nil
	}
	return "", nil
}

// AdminDeleteUserSubscription hard-deletes a user subscription.
func AdminDeleteUserSubscription(userSubscriptionId int) (string, error) {
	if userSubscriptionId <= 0 {
		return "", errors.New("invalid userSubscriptionId")
	}
	now := common.GetTimestamp()
	cacheGroup := ""
	downgradeGroup := ""
	var userId int
	err := DB.Transaction(func(tx *gorm.DB) error {
		var sub UserSubscription
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", userSubscriptionId).First(&sub).Error; err != nil {
			return err
		}
		userId = sub.UserId
		target, err := downgradeUserGroupForSubscriptionTx(tx, &sub, now)
		if err != nil {
			return err
		}
		if target != "" {
			cacheGroup = target
			downgradeGroup = target
		}
		if err := tx.Where("id = ?", userSubscriptionId).Delete(&UserSubscription{}).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if cacheGroup != "" && userId > 0 {
		_ = UpdateUserGroupCache(userId, cacheGroup)
	}
	if downgradeGroup != "" {
		return fmt.Sprintf("用户分组将回退到 %s", downgradeGroup), nil
	}
	return "", nil
}

func AdminUpdateUserSubscriptionTime(userSubscriptionId int, startTime int64, endTime int64) (string, error) {
	if userSubscriptionId <= 0 {
		return "", errors.New("invalid userSubscriptionId")
	}
	if startTime <= 0 || endTime <= 0 || endTime <= startTime {
		return "", errors.New("invalid subscription time range")
	}
	now := GetDBTimestamp()
	cacheGroup := ""
	finalStatus := ""
	userId := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		var sub UserSubscription
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", userSubscriptionId).First(&sub).Error; err != nil {
			return err
		}
		original := sub
		userId = sub.UserId
		sub.StartTime = startTime
		sub.EndTime = endTime
		sub.ActivatedAt = 0
		sub.LastResetTime = 0
		sub.NextResetTime = 0
		if startTime > now {
			sub.Status = SubscriptionStatusQueued
		} else if endTime <= now {
			sub.Status = SubscriptionStatusExpired
		} else {
			// 先回到 queued，再由 refresh 流程按套餐规则决定是否立即激活。
			sub.Status = SubscriptionStatusQueued
		}
		if err := tx.Save(&sub).Error; err != nil {
			return err
		}
		if original.Status == SubscriptionStatusActive && original.EndTime > now {
			target, err := downgradeUserGroupForSubscriptionTx(tx, &original, now)
			if err != nil {
				return err
			}
			if target != "" {
				cacheGroup = target
			}
		}
		if err := refreshUserSubscriptionsTx(tx, sub.UserId, now); err != nil {
			return err
		}
		if err := tx.Where("id = ?", userSubscriptionId).First(&sub).Error; err != nil {
			return err
		}
		finalStatus = sub.Status
		if strings.TrimSpace(sub.UpgradeGroup) != "" && sub.Status == SubscriptionStatusActive {
			cacheGroup = sub.UpgradeGroup
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if cacheGroup != "" && userId > 0 {
		_ = UpdateUserGroupCache(userId, cacheGroup)
	}
	if finalStatus == SubscriptionStatusQueued {
		return fmt.Sprintf("订阅有效期已调整，将于 %s 生效", time.Unix(startTime, 0).Format("2006-01-02 15:04:05")), nil
	}
	if finalStatus == SubscriptionStatusExpired {
		return "订阅有效期已调整，当前已过期", nil
	}
	return "订阅有效期已调整", nil
}

type SubscriptionPreConsumeResult struct {
	UserSubscriptionId int
	PreConsumed        int64
	AmountTotal        int64
	AmountUsedBefore   int64
	AmountUsedAfter    int64
}

// ExpireDueSubscriptions marks expired subscriptions and handles group downgrade.
func ExpireDueSubscriptions(limit int) (int, error) {
	if limit <= 0 {
		limit = 200
	}
	now := GetDBTimestamp()
	var dueSubs []UserSubscription
	if err := DB.Where("(status = ? AND end_time > 0 AND end_time <= ?) OR (status = ? AND start_time <= ? AND end_time > ?)",
		SubscriptionStatusActive, now, SubscriptionStatusQueued, now, now).
		Order("end_time asc, id asc").
		Limit(limit).
		Find(&dueSubs).Error; err != nil {
		return 0, err
	}
	if len(dueSubs) == 0 {
		return 0, nil
	}
	userIds := make(map[int]struct{}, len(dueSubs))
	for _, sub := range dueSubs {
		if sub.UserId > 0 {
			userIds[sub.UserId] = struct{}{}
		}
	}
	expiredCount := 0
	for userId := range userIds {
		err := DB.Transaction(func(tx *gorm.DB) error {
			var beforeCount int64
			if err := tx.Model(&UserSubscription{}).
				Where("user_id = ? AND status = ? AND end_time > 0 AND end_time <= ?", userId, SubscriptionStatusActive, now).
				Count(&beforeCount).Error; err != nil {
				return err
			}
			if err := refreshUserSubscriptionsTx(tx, userId, now); err != nil {
				return err
			}
			expiredCount += int(beforeCount)
			return nil
		})
		if err != nil {
			return expiredCount, err
		}
	}
	return expiredCount, nil
}

// SubscriptionPreConsumeRecord stores idempotent pre-consume operations per request.
type SubscriptionPreConsumeRecord struct {
	Id                 int    `json:"id"`
	RequestId          string `json:"request_id" gorm:"type:varchar(64);uniqueIndex"`
	UserId             int    `json:"user_id" gorm:"index"`
	UserSubscriptionId int    `json:"user_subscription_id" gorm:"index"`
	PreConsumed        int64  `json:"pre_consumed" gorm:"type:bigint;not null;default:0"`
	Status             string `json:"status" gorm:"type:varchar(32);index"` // consumed/refunded
	CreatedAt          int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt          int64  `json:"updated_at" gorm:"bigint;index"`
}

func (r *SubscriptionPreConsumeRecord) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	r.CreatedAt = now
	r.UpdatedAt = now
	return nil
}

func (r *SubscriptionPreConsumeRecord) BeforeUpdate(tx *gorm.DB) error {
	r.UpdatedAt = common.GetTimestamp()
	return nil
}

func maybeResetUserSubscriptionWithPlanTx(tx *gorm.DB, sub *UserSubscription, plan *SubscriptionPlan, now int64) error {
	if tx == nil || sub == nil || plan == nil {
		return errors.New("invalid reset args")
	}
	plan.QuotaResetPeriod = NormalizeResetPeriod(plan.QuotaResetPeriod)
	plan.ActivationMode = NormalizeActivationMode(plan.ActivationMode)
	if sub.NextResetTime > 0 && sub.NextResetTime > now {
		return nil
	}
	if NormalizeResetPeriod(plan.QuotaResetPeriod) == SubscriptionResetNever {
		return nil
	}
	baseUnix := sub.LastResetTime
	if baseUnix <= 0 {
		baseUnix = sub.StartTime
	}
	base := time.Unix(baseUnix, 0)
	next := calcNextResetTime(base, plan, sub.EndTime)
	advanced := false
	for next > 0 && next <= now {
		advanced = true
		base = time.Unix(next, 0)
		next = calcNextResetTime(base, plan, sub.EndTime)
	}
	if !advanced {
		if sub.NextResetTime == 0 && next > 0 {
			sub.NextResetTime = next
			sub.LastResetTime = base.Unix()
			sub.AmountTotal = plan.TotalAmount
			return tx.Save(sub).Error
		}
		return nil
	}
	sub.AmountTotal = plan.TotalAmount
	sub.AmountUsed = 0
	sub.LastResetTime = base.Unix()
	sub.NextResetTime = next
	return tx.Save(sub).Error
}

// PreConsumeUserSubscription pre-consumes from any active subscription total quota.
func PreConsumeUserSubscription(requestId string, userId int, modelName string, quotaType int, amount int64) (*SubscriptionPreConsumeResult, error) {
	if userId <= 0 {
		return nil, errors.New("invalid userId")
	}
	if strings.TrimSpace(requestId) == "" {
		return nil, errors.New("requestId is empty")
	}
	if amount <= 0 {
		return nil, errors.New("amount must be > 0")
	}
	if err := RefreshUserSubscriptions(userId); err != nil {
		return nil, err
	}
	now := GetDBTimestamp()

	returnValue := &SubscriptionPreConsumeResult{}

	err := DB.Transaction(func(tx *gorm.DB) error {
		var existing SubscriptionPreConsumeRecord
		query := tx.Where("request_id = ?", requestId).Limit(1).Find(&existing)
		if query.Error != nil {
			return query.Error
		}
		if query.RowsAffected > 0 {
			if existing.Status == "refunded" {
				return errors.New("subscription pre-consume already refunded")
			}
			var sub UserSubscription
			if err := tx.Where("id = ?", existing.UserSubscriptionId).First(&sub).Error; err != nil {
				return err
			}
			returnValue.UserSubscriptionId = sub.Id
			returnValue.PreConsumed = existing.PreConsumed
			returnValue.AmountTotal = sub.AmountTotal
			returnValue.AmountUsedBefore = sub.AmountUsed
			returnValue.AmountUsedAfter = sub.AmountUsed
			return nil
		}

		var subs []UserSubscription
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("user_id = ? AND status = ? AND end_time > ?", userId, SubscriptionStatusActive, now).
			Order("end_time asc, id asc").
			Find(&subs).Error; err != nil {
			return errors.New("no active subscription")
		}
		if len(subs) == 0 {
			return errors.New("no active subscription")
		}
		for _, candidate := range subs {
			sub := candidate
			if err := maybeResetUserSubscriptionWithPlanTx(tx, &sub, buildSubscriptionSnapshotPlan(&sub), now); err != nil {
				return err
			}
			usedBefore := sub.AmountUsed
			if sub.AmountTotal > 0 {
				remain := sub.AmountTotal - usedBefore
				if remain < amount {
					continue
				}
			}
			record := &SubscriptionPreConsumeRecord{
				RequestId:          requestId,
				UserId:             userId,
				UserSubscriptionId: sub.Id,
				PreConsumed:        amount,
				Status:             "consumed",
			}
			if err := tx.Create(record).Error; err != nil {
				var dup SubscriptionPreConsumeRecord
				if err2 := tx.Where("request_id = ?", requestId).First(&dup).Error; err2 == nil {
					if dup.Status == "refunded" {
						return errors.New("subscription pre-consume already refunded")
					}
					returnValue.UserSubscriptionId = sub.Id
					returnValue.PreConsumed = dup.PreConsumed
					returnValue.AmountTotal = sub.AmountTotal
					returnValue.AmountUsedBefore = sub.AmountUsed
					returnValue.AmountUsedAfter = sub.AmountUsed
					return nil
				}
				return err
			}
			sub.AmountUsed += amount
			if err := tx.Save(&sub).Error; err != nil {
				return err
			}
			returnValue.UserSubscriptionId = sub.Id
			returnValue.PreConsumed = amount
			returnValue.AmountTotal = sub.AmountTotal
			returnValue.AmountUsedBefore = usedBefore
			returnValue.AmountUsedAfter = sub.AmountUsed
			return nil
		}
		return fmt.Errorf("subscription quota insufficient, need=%d", amount)
	})
	if err != nil {
		return nil, err
	}
	return returnValue, nil
}

// RefundSubscriptionPreConsume is idempotent and refunds pre-consumed subscription quota by requestId.
func RefundSubscriptionPreConsume(requestId string) error {
	if strings.TrimSpace(requestId) == "" {
		return errors.New("requestId is empty")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var record SubscriptionPreConsumeRecord
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("request_id = ?", requestId).First(&record).Error; err != nil {
			return err
		}
		if record.Status == "refunded" {
			return nil
		}
		if record.PreConsumed <= 0 {
			record.Status = "refunded"
			return tx.Save(&record).Error
		}
		if err := PostConsumeUserSubscriptionDelta(record.UserSubscriptionId, -record.PreConsumed); err != nil {
			return err
		}
		record.Status = "refunded"
		return tx.Save(&record).Error
	})
}

// ResetDueSubscriptions resets subscriptions whose next_reset_time has passed.
func ResetDueSubscriptions(limit int) (int, error) {
	if limit <= 0 {
		limit = 200
	}
	now := GetDBTimestamp()
	var subs []UserSubscription
	if err := DB.Where("next_reset_time > 0 AND next_reset_time <= ? AND status = ?", now, SubscriptionStatusActive).
		Order("next_reset_time asc").
		Limit(limit).
		Find(&subs).Error; err != nil {
		return 0, err
	}
	if len(subs) == 0 {
		return 0, nil
	}
	resetCount := 0
	for _, sub := range subs {
		subCopy := sub
		plan, err := getSubscriptionPlanByIdTx(nil, sub.PlanId)
		if err != nil || plan == nil {
			continue
		}
		err = DB.Transaction(func(tx *gorm.DB) error {
			var locked UserSubscription
			if err := tx.Set("gorm:query_option", "FOR UPDATE").
				Where("id = ? AND next_reset_time > 0 AND next_reset_time <= ?", subCopy.Id, now).
				First(&locked).Error; err != nil {
				return nil
			}
			if err := maybeResetUserSubscriptionWithPlanTx(tx, &locked, plan, now); err != nil {
				return err
			}
			resetCount++
			return nil
		})
		if err != nil {
			return resetCount, err
		}
	}
	return resetCount, nil
}

// CleanupSubscriptionPreConsumeRecords removes old idempotency records to keep table small.
func CleanupSubscriptionPreConsumeRecords(olderThanSeconds int64) (int64, error) {
	if olderThanSeconds <= 0 {
		olderThanSeconds = 7 * 24 * 3600
	}
	cutoff := GetDBTimestamp() - olderThanSeconds
	res := DB.Where("updated_at < ?", cutoff).Delete(&SubscriptionPreConsumeRecord{})
	return res.RowsAffected, res.Error
}

type SubscriptionPlanInfo struct {
	PlanId    int
	PlanTitle string
}

func GetSubscriptionPlanInfoByUserSubscriptionId(userSubscriptionId int) (*SubscriptionPlanInfo, error) {
	if userSubscriptionId <= 0 {
		return nil, errors.New("invalid userSubscriptionId")
	}
	cacheKey := fmt.Sprintf("sub:%d", userSubscriptionId)
	if cached, found, err := getSubscriptionPlanInfoCache().Get(cacheKey); err == nil && found {
		return &cached, nil
	}
	var sub UserSubscription
	if err := DB.Where("id = ?", userSubscriptionId).First(&sub).Error; err != nil {
		return nil, err
	}
	plan, err := getSubscriptionPlanByIdTx(nil, sub.PlanId)
	if err != nil {
		return nil, err
	}
	info := &SubscriptionPlanInfo{
		PlanId:    sub.PlanId,
		PlanTitle: plan.Title,
	}
	_ = getSubscriptionPlanInfoCache().SetWithTTL(cacheKey, *info, subscriptionPlanInfoCacheTTL())
	return info, nil
}

// Update subscription used amount by delta (positive consume more, negative refund).
func PostConsumeUserSubscriptionDelta(userSubscriptionId int, delta int64) error {
	if userSubscriptionId <= 0 {
		return errors.New("invalid userSubscriptionId")
	}
	if delta == 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var sub UserSubscription
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", userSubscriptionId).
			First(&sub).Error; err != nil {
			return err
		}
		newUsed := sub.AmountUsed + delta
		if newUsed < 0 {
			newUsed = 0
		}
		if sub.AmountTotal > 0 && newUsed > sub.AmountTotal {
			return fmt.Errorf("subscription used exceeds total, used=%d total=%d", newUsed, sub.AmountTotal)
		}
		sub.AmountUsed = newUsed
		return tx.Save(&sub).Error
	})
}
