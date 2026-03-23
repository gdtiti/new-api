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
}

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
	b.Url = strings.TrimSpace(b.Url)
	return nil
}

func (b *ChannelBaseURL) BeforeUpdate(tx *gorm.DB) error {
	b.UpdatedAt = common.GetTimestamp()
	b.Url = strings.TrimSpace(b.Url)
	return nil
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
	if DB.Migrator().HasTable(&ChannelBaseURL{}) {
		channelBaseURLSchemaEnsuredDB = DB
		return nil
	}
	if err := DB.AutoMigrate(&ChannelBaseURL{}); err != nil {
		return err
	}
	channelBaseURLSchemaEnsuredDB = DB
	common.SysLog("channel_base_urls table was missing and has been auto-created")
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
