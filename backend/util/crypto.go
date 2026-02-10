package util

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"os"
)

var encryptionKey []byte

func init() {
	keyStr := os.Getenv("ENCRYPTION_KEY")
	if keyStr == "" {
		keyStr = "default-encryption-key-32-bytes!!" // Exactly 32 bytes for AES-256
	}

	encryptionKey = []byte(keyStr)
	if len(encryptionKey) != 32 {
		// pad or truncate to 32 bytes for AES-256
		newKey := make([]byte, 32)
		copy(newKey, encryptionKey)
		encryptionKey = newKey
	}
}

// Encrypt encrypts plain text string into a base64 encoded string
func Encrypt(plainText string) (string, error) {
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plainText), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts a base64 encoded encrypted string
func Decrypt(cryptoText string) (string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(cryptoText)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plainText, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plainText), nil
}

// MaskCredential masks a credential string for display in UI
func MaskCredential(cred string) string {
	if len(cred) < 8 {
		return "********"
	}
	return cred[:4] + "...." + cred[len(cred)-4:]
}
