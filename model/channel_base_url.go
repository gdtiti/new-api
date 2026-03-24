package model

import (
	"fmt"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// ChannelBaseURL stores per-channel base URL entries for upstream routing.
//
// Notes:
// - If a channel has 0 rows in this table => legacy mode, fall back to Channel.BaseURL / defaults.
// - If a channel has rows but all are disabled => DO NOT fall back (must return explicit error for relay paths).
type ChannelBaseURL struct {
	Id        int   `json:"id"`
	CreatedAt int64 `json:"created_at" gorm:"bigint;index"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`

	ChannelId int    `json:"channel_id" gorm:"index;not null"`
	Url       string `json:"url" gorm:"type:varchar(512);not null"`

	Enabled   bool `json:"enabled" gorm:"index;default:true"`
	Weight    int  `json:"weight" gorm:"default:1"`
	SortOrder int  `json:"sort_order" gorm:"index;default:0"`

	AutoDisableEnabled        bool   `json:"auto_disable_enabled" gorm:"default:false"`
	AutoDisableStatusCodes    string `json:"auto_disable_status_codes" gorm:"type:varchar(255);default:''"`
	AutoDisableErrorThreshold int    `json:"auto_disable_error_threshold" gorm:"default:0"`
	AutoDisableModels         string `json:"auto_disable_models" gorm:"type:text"`

	DisableSource         string `json:"disable_source" gorm:"type:varchar(32);default:''"`
	DisableReason         string `json:"disable_reason" gorm:"type:text"`
	DisabledAt            int64  `json:"disabled_at" gorm:"bigint;default:0"`
	ConsecutiveFailures   int    `json:"consecutive_failures" gorm:"default:0"`
	LastFailureStatusCode int    `json:"last_failure_status_code" gorm:"default:0"`
	LastFailureModel      string `json:"last_failure_model" gorm:"type:varchar(255);default:''"`
	LastFailureAt         int64  `json:"last_failure_at" gorm:"bigint;default:0"`

	HealthCheckEnabled      bool   `json:"health_check_enabled" gorm:"default:false"`
	HealthCheckModel        string `json:"health_check_model" gorm:"type:varchar(255);default:''"`
	HealthCheckEndpointType string `json:"health_check_endpoint_type" gorm:"type:varchar(64);default:''"`
	LastHealthCheckAt       int64  `json:"last_health_check_at" gorm:"bigint;default:0"`
	LastHealthCheckSuccess  bool   `json:"last_health_check_success" gorm:"default:false"`
	LastHealthCheckMessage  string `json:"last_health_check_message" gorm:"type:text"`
}

const (
	ChannelBaseURLDisableSourceManual      = "manual"
	ChannelBaseURLDisableSourceAutoError   = "auto_error"
	ChannelBaseURLDisableSourceHealthCheck = "health_check"
)

var (
	channelBaseURLSchemaEnsureLock sync.Mutex
	channelBaseURLSchemaEnsuredDB  *gorm.DB
)

func (b *ChannelBaseURL) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	if b.CreatedAt == 0 {
		b.CreatedAt = now
	}
	if b.UpdatedAt == 0 {
		b.UpdatedAt = now
	}
	b.normalize()
	return nil
}

func (b *ChannelBaseURL) BeforeUpdate(tx *gorm.DB) error {
	b.UpdatedAt = common.GetTimestamp()
	b.normalize()
	return nil
}

func (b *ChannelBaseURL) normalize() {
	b.Url = strings.TrimSpace(b.Url)
	b.AutoDisableStatusCodes = strings.TrimSpace(b.AutoDisableStatusCodes)
	b.AutoDisableModels = strings.TrimSpace(b.AutoDisableModels)
	b.DisableSource = strings.TrimSpace(b.DisableSource)
	b.DisableReason = strings.TrimSpace(b.DisableReason)
	b.LastFailureModel = strings.TrimSpace(b.LastFailureModel)
	b.HealthCheckModel = strings.TrimSpace(b.HealthCheckModel)
	b.HealthCheckEndpointType = strings.TrimSpace(b.HealthCheckEndpointType)
	b.LastHealthCheckMessage = strings.TrimSpace(b.LastHealthCheckMessage)
}

func (b *ChannelBaseURL) ClearDisableState() {
	if b == nil {
		return
	}
	b.DisableSource = ""
	b.DisableReason = ""
	b.DisabledAt = 0
}

func (b *ChannelBaseURL) ResetFailureState() {
	if b == nil {
		return
	}
	b.ConsecutiveFailures = 0
}

func (b *ChannelBaseURL) MarkManualEnabled() {
	if b == nil {
		return
	}
	b.Enabled = true
	b.ClearDisableState()
	b.ResetFailureState()
}

func (b *ChannelBaseURL) MarkManualDisabled() {
	if b == nil {
		return
	}
	b.Enabled = false
	b.DisableSource = ChannelBaseURLDisableSourceManual
	b.DisableReason = ""
	b.DisabledAt = common.GetTimestamp()
	b.ResetFailureState()
}

func EnsureChannelBaseURLSchema() error {
	if DB == nil {
		return fmt.Errorf("database is not initialized")
	}
	if channelBaseURLSchemaEnsuredDB == DB {
		return nil
	}

	channelBaseURLSchemaEnsureLock.Lock()
	defer channelBaseURLSchemaEnsureLock.Unlock()

	if channelBaseURLSchemaEnsuredDB == DB {
		return nil
	}
	if err := DB.AutoMigrate(&ChannelBaseURL{}); err != nil {
		return err
	}
	channelBaseURLSchemaEnsuredDB = DB
	return nil
}

func GetChannelBaseURLByID(id int) (*ChannelBaseURL, bool, error) {
	if id <= 0 {
		return nil, false, nil
	}
	if err := EnsureChannelBaseURLSchema(); err != nil {
		return nil, false, err
	}
	var baseURL ChannelBaseURL
	err := DB.Where("id = ?", id).First(&baseURL).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, false, nil
		}
		return nil, false, err
	}
	return &baseURL, true, nil
}

func GetChannelBaseURLs(channelID int) ([]*ChannelBaseURL, error) {
	if channelID <= 0 {
		return nil, nil
	}
	if err := EnsureChannelBaseURLSchema(); err != nil {
		return nil, err
	}
	var baseURLs []*ChannelBaseURL
	err := DB.Where("channel_id = ?", channelID).
		Order("sort_order asc").
		Order("id asc").
		Find(&baseURLs).Error
	return baseURLs, err
}

func CacheGetChannelBaseURLs(channelID int) ([]*ChannelBaseURL, error) {
	if channelID <= 0 {
		return nil, nil
	}
	if err := EnsureChannelBaseURLSchema(); err != nil {
		return nil, err
	}
	if !common.MemoryCacheEnabled {
		return GetChannelBaseURLs(channelID)
	}
	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()
	if channelBaseURLsIDM == nil {
		return nil, nil
	}
	return channelBaseURLsIDM[channelID], nil
}
