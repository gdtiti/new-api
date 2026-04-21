package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type legacyChannelSchema struct {
	Id                 int
	Type               int    `gorm:"default:0"`
	Key                string `gorm:"not null"`
	OpenAIOrganization *string
	TestModel          *string
	Status             int    `gorm:"default:1"`
	Name               string `gorm:"index"`
	Weight             *uint  `gorm:"default:0"`
	CreatedTime        int64  `gorm:"bigint"`
	TestTime           int64  `gorm:"bigint"`
	ResponseTime       int
	BaseURL            *string `gorm:"column:base_url;default:''"`
	Other              string
	Balance            float64
	BalanceUpdatedTime int64 `gorm:"bigint"`
	Models             string
	Group              string  `gorm:"type:varchar(64);default:'default'"`
	UsedQuota          int64   `gorm:"bigint;default:0"`
	ModelMapping       *string `gorm:"type:text"`
	StatusCodeMapping  *string `gorm:"type:varchar(1024);default:''"`
	Priority           *int64  `gorm:"bigint;default:0"`
	AutoBan            *int    `gorm:"default:1"`
	OtherInfo          string
	Tag                *string     `gorm:"index"`
	Setting            *string     `gorm:"type:text"`
	ParamOverride      *string     `gorm:"type:text"`
	HeaderOverride     *string     `gorm:"type:text"`
	Remark             *string     `gorm:"type:varchar(255)"`
	ChannelInfo        ChannelInfo `gorm:"type:json"`
	OtherSettings      string      `gorm:"column:settings"`
}

func (legacyChannelSchema) TableName() string {
	return "channels"
}

func TestEnsureRuntimeSchemaCompatibilityAddsMaxConcurrencyForLegacyChannels(t *testing.T) {
	db := setupRegisterDefaultSubscriptionTestDB(t)

	prevUsingMySQL := common.UsingMySQL
	prevUsingPostgreSQL := common.UsingPostgreSQL
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	t.Cleanup(func() {
		common.UsingMySQL = prevUsingMySQL
		common.UsingPostgreSQL = prevUsingPostgreSQL
	})

	require.NoError(t, db.AutoMigrate(&legacyChannelSchema{}))
	require.False(t, db.Migrator().HasColumn(&Channel{}, "max_concurrency"))

	priority := int64(10)
	weight := uint(1)
	autoBan := 1
	legacy := &legacyChannelSchema{
		Type:          constant.ChannelTypeOpenAI,
		Key:           "legacy-key",
		Status:        common.ChannelStatusEnabled,
		Name:          "legacy-channel",
		Weight:        &weight,
		CreatedTime:   1,
		TestTime:      1,
		ResponseTime:  123,
		Group:         "default",
		Models:        "gpt-4o",
		Priority:      &priority,
		AutoBan:       &autoBan,
		OtherSettings: "",
	}
	require.NoError(t, db.Create(legacy).Error)

	require.NoError(t, ensureRuntimeSchemaCompatibility())
	require.True(t, db.Migrator().HasColumn(&Channel{}, "max_concurrency"))

	var channel Channel
	require.NoError(t, DB.First(&channel, "id = ?", legacy.Id).Error)
	assert.Equal(t, legacy.Name, channel.Name)
	assert.Equal(t, 0, channel.GetMaxConcurrency())
}

func TestInitDBSlaveRepairsLegacyChannelSchemaForChannelListQuery(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "legacy-runtime.db")

	legacyDB, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, legacyDB.AutoMigrate(&legacyChannelSchema{}))

	priority := int64(20)
	weight := uint(1)
	autoBan := 1
	require.NoError(t, legacyDB.Create(&legacyChannelSchema{
		Type:          constant.ChannelTypeOpenAI,
		Key:           "legacy-runtime-key",
		Status:        common.ChannelStatusEnabled,
		Name:          "legacy-runtime-channel",
		Weight:        &weight,
		Group:         "default",
		Models:        "gpt-4o",
		Priority:      &priority,
		AutoBan:       &autoBan,
		OtherSettings: "",
	}).Error)

	sqlDB, err := legacyDB.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())

	prevDB := DB
	prevLogDB := LOG_DB
	prevSQLitePath := common.SQLitePath
	prevUsingSQLite := common.UsingSQLite
	prevUsingMySQL := common.UsingMySQL
	prevUsingPostgreSQL := common.UsingPostgreSQL
	prevIsMasterNode := common.IsMasterNode
	t.Cleanup(func() {
		if DB != nil {
			if currentSQLDB, currentErr := DB.DB(); currentErr == nil {
				_ = currentSQLDB.Close()
			}
		}
		DB = prevDB
		LOG_DB = prevLogDB
		common.SQLitePath = prevSQLitePath
		common.UsingSQLite = prevUsingSQLite
		common.UsingMySQL = prevUsingMySQL
		common.UsingPostgreSQL = prevUsingPostgreSQL
		common.IsMasterNode = prevIsMasterNode
	})

	DB = nil
	LOG_DB = nil
	common.SQLitePath = dbPath
	common.UsingSQLite = false
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.IsMasterNode = false

	require.NoError(t, InitDB())
	require.True(t, DB.Migrator().HasColumn(&Channel{}, "max_concurrency"))

	var channelData []*Channel
	err = DB.Model(&Channel{}).
		Order("priority desc").
		Limit(10).
		Offset(0).
		Omit("key").
		Find(&channelData).Error
	require.NoError(t, err)
	require.Len(t, channelData, 1)
	assert.Equal(t, "legacy-runtime-channel", channelData[0].Name)
	assert.Equal(t, 0, channelData[0].GetMaxConcurrency())
}
