package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/user/misignage/auth"
	"github.com/user/misignage/db"
	"github.com/user/misignage/models"
	"github.com/user/misignage/util"
	"golang.org/x/crypto/bcrypt"
)

func GetUsers(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)

	// Only admins can list users
	if user.Role != "admin" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Unauthorized"})
	}

	var users []models.User
	db.DB.Where("organization_id = ?", user.OrganizationID).Find(&users)
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

	if email == "" || password == "" || role == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Missing required fields"})
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

	user := models.User{
		Email:          email,
		PasswordHash:   string(hash),
		Role:           role,
		OrganizationID: admin.OrganizationID,
	}

	if err := db.DB.Create(&user).Error; err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "User already exists or failed to create"})
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
