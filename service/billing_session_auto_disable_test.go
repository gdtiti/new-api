package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewBillingSessionDisablesTemporaryUserWhenQuotaExhausted(t *testing.T) {
	truncate(t)

	const userID = 201
	const tokenID = 301

	user := &model.User{
		Id:                      userID,
		Username:                "temp_quota_zero",
		Password:                "hashedpass",
		DisplayName:             "temp_quota_zero",
		Status:                  common.UserStatusEnabled,
		Group:                   "default",
		Quota:                   0,
		IsTemporary:             true,
		TemporaryDefaultTokenId: tokenID,
	}
	require.NoError(t, model.DB.Create(user).Error)

	token := &model.Token{
		Id:          tokenID,
		UserId:      userID,
		Key:         "sk-temp-zero",
		Name:        "temp-default",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 0,
		Group:       "default",
	}
	require.NoError(t, model.DB.Create(token).Error)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	session, apiErr := NewBillingSession(c, &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        token.Key,
		OriginModelName: "test-model",
		UserSetting: dto.UserSetting{
			BillingPreference: "wallet_only",
		},
	}, 100)

	require.Nil(t, session)
	require.NotNil(t, apiErr)
	assert.Equal(t, types.ErrorCodeUpdateDataError, apiErr.GetErrorCode())
	assert.Contains(t, apiErr.Error(), "临时账号额度不足")

	var refreshedUser model.User
	require.NoError(t, model.DB.Where("id = ?", userID).First(&refreshedUser).Error)
	assert.Equal(t, common.UserStatusDisabled, refreshedUser.Status)

	var refreshedToken model.Token
	require.NoError(t, model.DB.Where("id = ?", tokenID).First(&refreshedToken).Error)
	assert.Equal(t, common.TokenStatusDisabled, refreshedToken.Status)
}
