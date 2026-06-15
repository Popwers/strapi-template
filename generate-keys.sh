#!/bin/sh

ENV_FILE=".env"

# Generate a single base64 secret.
generate_secret() {
    openssl rand -base64 16
}

# Generate the APP_KEYS value: 4 comma-separated base64 secrets (Strapi expects a list).
generate_app_keys() {
    printf '%s,%s,%s,%s' "$(generate_secret)" "$(generate_secret)" "$(generate_secret)" "$(generate_secret)"
}

# Write KEY=VALUE into .env, replacing an existing line or appending a new one.
write_key() {
    KEY_NAME=$1
    NEW_VALUE=$2

    if grep -q "^${KEY_NAME}=" "$ENV_FILE"; then
        # macOS sed needs an explicit empty backup suffix; GNU sed does not.
        case "$(uname)" in
            Darwin) sed -i '' "s|^${KEY_NAME}=.*|${KEY_NAME}=${NEW_VALUE}|" "$ENV_FILE" ;;
            *) sed -i "s|^${KEY_NAME}=.*|${KEY_NAME}=${NEW_VALUE}|" "$ENV_FILE" ;;
        esac
    else
        echo "${KEY_NAME}=${NEW_VALUE}" >> "$ENV_FILE"
    fi
}

# Generate a key only if it is missing or empty in .env.
generate_if_missing() {
    KEY_NAME=$1

    if [ ! -f "$ENV_FILE" ]; then
        echo "Error: .env file not found"
        exit 1
    fi

    # -f2- keeps everything after the first '=' so base64 padding / commas survive.
    CURRENT_VALUE=$(grep "^${KEY_NAME}=" "$ENV_FILE" | cut -d '=' -f2-)

    if [ -z "$CURRENT_VALUE" ]; then
        if [ "$KEY_NAME" = "APP_KEYS" ]; then
            NEW_VALUE=$(generate_app_keys)
        else
            NEW_VALUE=$(generate_secret)
        fi

        write_key "$KEY_NAME" "$NEW_VALUE"
        # Never print the value itself — it would leak into shell history and CI logs.
        echo "Generated ${KEY_NAME} (value written to .env)"
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
