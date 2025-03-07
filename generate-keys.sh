#!/bin/sh

# Function to check and generate a key if it doesn't exist
generate_if_missing() {
    local KEY_NAME=$1
    local ENV_FILE=".env"

    # Check if .env exists
    if [ ! -f "$ENV_FILE" ]; then
        echo "Error: .env file not found"
        exit 1
    fi

    # Read current value from .env
    local CURRENT_VALUE=$(grep "^${KEY_NAME}=" "$ENV_FILE" | cut -d '=' -f2)

    # If empty or not set, generate and add to .env
    if [ -z "$CURRENT_VALUE" ]; then
        local NEW_VALUE=$(openssl rand -base64 16)

        # If key exists but empty, replace the line
        if grep -q "^${KEY_NAME}=" "$ENV_FILE"; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sed -i '' "s|^${KEY_NAME}=.*|${KEY_NAME}=${NEW_VALUE}|" "$ENV_FILE"
            else
                # Linux
                sed -i "s|^${KEY_NAME}=.*|${KEY_NAME}=${NEW_VALUE}|" "$ENV_FILE"
            fi
        else
            # If key doesn't exist, append it
            echo "${KEY_NAME}=${NEW_VALUE}" >> "$ENV_FILE"
        fi

        echo "Generated ${KEY_NAME}=${NEW_VALUE}"
    else
        echo "${KEY_NAME} already exists in .env"
    fi
}

# Generate keys if missing
generate_if_missing "APP_KEYS"
generate_if_missing "API_TOKEN_SALT"
generate_if_missing "JWT_SECRET"
generate_if_missing "ADMIN_JWT_SECRET"
generate_if_missing "TRANSFER_TOKEN_SALT"
