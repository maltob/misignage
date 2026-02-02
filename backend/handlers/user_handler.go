package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/models"
	"github.com/maltob/misignage/util"
	"golang.org/x/crypto/bcrypt"
)

func GetUsers(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)

	// Only admins can list users
	if user.Role != "admin" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Unauthorized"})
	}

	var users []models.User
	db.DB.Preload("Groups").Where("organization_id = ?", user.OrganizationID).Find(&users)
	return c.JSON(http.StatusOK, users)
}

func CreateUser(c echo.Context) error {
	admin := c.Get("user").(*auth.JwtCustomClaims)
	if admin.Role != "admin" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Unauthorized"})
	}

	email := c.FormValue("email")
	password := c.FormValue("password")
	role := c.FormValue("role")
	isOIDC := c.FormValue("is_oidc") == "true"

	if email == "" || (!isOIDC && password == "") || role == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Missing required fields"})
	}

	var hash []byte
	if password != "" {
		hash, _ = bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	}

	user := models.User{
		Email:          email,
		PasswordHash:   string(hash),
		Role:           role,
		OrganizationID: admin.OrganizationID,
	}

	if err := db.DB.Create(&user).Error; err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "User already exists or failed to create"})
	}

	// Assign groups if provided
	if groupIDs := c.Request().Form["group_ids[]"]; len(groupIDs) > 0 {
		var groups []models.Group
		db.DB.Where("id IN ?", groupIDs).Find(&groups)
		db.DB.Model(&user).Association("Groups").Replace(groups)
	}

	util.LogAudit(c, "CREATE", "USER", user.ID, fmt.Sprintf("Created user: %s (Role: %s)", user.Email, user.Role))
	return c.JSON(http.StatusCreated, user)
}

func UpdateUser(c echo.Context) error {
	admin := c.Get("user").(*auth.JwtCustomClaims)
	if admin.Role != "admin" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Unauthorized"})
	}

	id := c.Param("id")
	var user models.User
	if err := db.DB.Where("id = ? AND organization_id = ?", id, admin.OrganizationID).First(&user).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	// Prevents deleting yourself or changing your own role accidentally if we want to be strict
	// But let's keep it simple for now.

	if role := c.FormValue("role"); role != "" {
		user.Role = role
	}
	if email := c.FormValue("email"); email != "" {
		user.Email = email
	}
	if password := c.FormValue("password"); password != "" {
		hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		user.PasswordHash = string(hash)
	}

	db.DB.Save(&user)

	// Update groups if provided
	if groupIDs := c.Request().Form["group_ids[]"]; len(groupIDs) > 0 {
		var groups []models.Group
		db.DB.Where("id IN ?", groupIDs).Find(&groups)
		db.DB.Model(&user).Association("Groups").Replace(groups)
	} else if c.FormValue("group_ids_cleared") == "true" {
		db.DB.Model(&user).Association("Groups").Clear()
	}

	util.LogAudit(c, "UPDATE", "USER", user.ID, fmt.Sprintf("Updated user: %s", user.Email))
	return c.JSON(http.StatusOK, user)
}

func DeleteUser(c echo.Context) error {
	admin := c.Get("user").(*auth.JwtCustomClaims)
	if admin.Role != "admin" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Unauthorized"})
	}

	id := c.Param("id")
	if err := db.DB.Where("id = ? AND organization_id = ?", id, admin.OrganizationID).Delete(&models.User{}).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete user"})
	}

	idUint, _ := strconv.Atoi(id)
	util.LogAudit(c, "DELETE", "USER", uint(idUint), fmt.Sprintf("Deleted user ID: %s", id))
	return c.NoContent(http.StatusOK)
}
