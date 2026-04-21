package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateTemporaryUserCreatesUserAndDefaultToken(t *testing.T) {
	truncate(t)

	admin := &model.User{
		Id:          100,
		Username:    "temp_admin",
		Password:    "hashedpass",
		DisplayName: "temp_admin",
		Role:        common.RoleAdminUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
	}
	require.NoError(t, model.DB.Create(admin).Error)

	result, err := CreateTemporaryUser(admin.Id, CreateTemporaryUserRequest{
		DisplayName:  "临时账号",
		InitialQuota: 8888,
		UserGroup:    "default",
		TokenGroup:   "auto",
		TokenName:    "temp-default",
	})
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.NotZero(t, result.UserId)
	assert.NotEmpty(t, result.Username)
	assert.NotEmpty(t, result.Password)
	assert.Equal(t, 8888, result.Quota)
	assert.Equal(t, "default", result.Group)
	assert.Equal(t, "auto", result.TokenGroup)
	assert.NotZero(t, result.DefaultTokenId)
	assert.NotEmpty(t, result.DefaultToken)

	var user model.User
	require.NoError(t, model.DB.Where("id = ?", result.UserId).First(&user).Error)
	assert.True(t, user.IsTemporary)
	assert.Equal(t, admin.Id, user.TemporaryCreatedBy)
	assert.Equal(t, result.DefaultTokenId, user.TemporaryDefaultTokenId)
	assert.Equal(t, 8888, user.Quota)

	var token model.Token
	require.NoError(t, model.DB.Where("id = ?", result.DefaultTokenId).First(&token).Error)
	assert.Equal(t, result.UserId, token.UserId)
	assert.Equal(t, "auto", token.Group)
	assert.Equal(t, common.TokenStatusEnabled, token.Status)
}
