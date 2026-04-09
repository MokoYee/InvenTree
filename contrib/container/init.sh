#!/bin/bash

# exit when any command fails
set -e

# Required to suppress some git errors further down the line
if command -v git &> /dev/null; then
    git config --global --add safe.directory /home/***
fi

# Create required directory structure (if it does not already exist)
if [[ ! -d "$INVENTREE_STATIC_ROOT" ]]; then
    echo "Creating directory $INVENTREE_STATIC_ROOT"
    mkdir -p $INVENTREE_STATIC_ROOT
fi

if [[ ! -d "$INVENTREE_MEDIA_ROOT" ]]; then
    echo "Creating directory $INVENTREE_MEDIA_ROOT"
    mkdir -p $INVENTREE_MEDIA_ROOT
fi

if [[ ! -d "$INVENTREE_BACKUP_DIR" ]]; then
    echo "Creating directory $INVENTREE_BACKUP_DIR"
    mkdir -p $INVENTREE_BACKUP_DIR
fi

# Check if "config.yaml" has been copied into the correct location
if test -f "$INVENTREE_CONFIG_FILE"; then
    echo "Loading config file : $INVENTREE_CONFIG_FILE"
else
    echo "Copying config file from $INVENTREE_BACKEND_DIR/InvenTree/config_template.yml to $INVENTREE_CONFIG_FILE"
    cp $INVENTREE_BACKEND_DIR/InvenTree/config_template.yaml $INVENTREE_CONFIG_FILE
fi

# Setup a python virtual environment
# This should be done on the *mounted* filesystem,
# so that the installed modules persist!
if [[ -n "$INVENTREE_PY_ENV" ]]; then

    if test -d "$INVENTREE_PY_ENV"; then
        # venv already exists
        echo "Using Python virtual environment: ${INVENTREE_PY_ENV}"
        source ${INVENTREE_PY_ENV}/bin/activate
    else
        # Setup a virtual environment (within the provided directory)
        echo "Running first time setup for python environment"
        python3 -m venv ${INVENTREE_PY_ENV} --system-site-packages --upgrade-deps

        # Ensure invoke tool is installed locally
        source ${INVENTREE_PY_ENV}/bin/activate
        python3 -m pip install --ignore-installed --upgrade invoke
    fi

fi

cd ${INVENTREE_HOME}

MANAGE_PY="${INVENTREE_BACKEND_DIR}/InvenTree/manage.py"
FRONTEND_BUILD_INFO_DIR="${INVENTREE_BACKEND_DIR}/InvenTree/web/static/web/.vite"
STARTUP_MARKER="${INVENTREE_DATA_DIR}/.startup-image-sha"
STATIC_SYNC_MARKER="${INVENTREE_DATA_DIR}/.static-image-sha"

get_fingerprint_value() {
    local filepath="$1"

    if [[ -f "${filepath}" ]]; then
        tr -d '\r\n' < "${filepath}"
        return 0
    fi

    return 1
}

get_file_mtime() {
    local filepath="$1"

    if stat -c %Y "${filepath}" > /dev/null 2>&1; then
        stat -c %Y "${filepath}"
        return 0
    fi

    if stat -f %m "${filepath}" > /dev/null 2>&1; then
        stat -f %m "${filepath}"
        return 0
    fi

    return 1
}

get_runtime_sha() {
    if get_fingerprint_value "${FRONTEND_BUILD_INFO_DIR}/sha.txt"; then
        return
    fi

    if get_fingerprint_value "${FRONTEND_BUILD_INFO_DIR}/source.txt"; then
        return
    fi

    if [[ -n "${INVENTREE_COMMIT_HASH}" ]]; then
        printf '%s' "${INVENTREE_COMMIT_HASH}"
        return
    fi

    printf 'unknown'
}

needs_static_sync() {
    local runtime_sha
    local synced_sha

    runtime_sha="$(get_runtime_sha)"

    # 首次启动或静态目录不完整时，强制重新同步。
    if [[ ! -f "${INVENTREE_STATIC_ROOT}/web/index.html" ]]; then
        return 0
    fi

    if ! synced_sha="$(get_fingerprint_value "${STATIC_SYNC_MARKER}")"; then
        return 0
    fi

    if [[ "${runtime_sha}" == "${synced_sha}" ]]; then
        return 1
    fi

    return 0
}

backend_translations_need_compile() {
    local locale_dir="${INVENTREE_BACKEND_DIR}/InvenTree/locale"
    local po_file
    local mo_file

    if [[ ! -d "${locale_dir}" ]]; then
        return 1
    fi

    while IFS= read -r -d '' po_file; do
        mo_file="${po_file%.po}.mo"

        if [[ ! -f "${mo_file}" ]] || [[ "${po_file}" -nt "${mo_file}" ]]; then
            return 0
        fi
    done < <(find "${locale_dir}" -type f -name '*.po' -print0)

    return 1
}

ensure_backend_translations() {
    if backend_translations_need_compile; then
        echo "Compiling backend translations"
        python3 "${MANAGE_PY}" compilemessages
    else
        echo "Backend translations already up to date"
    fi
}

run_server_preflight() {
    local runtime_sha
    runtime_sha="$(get_runtime_sha)"

    # 每次服务启动前先清掉旧标记，避免 worker 复用上一次成功启动的状态。
    rm -f "${STARTUP_MARKER}"

    echo "Waiting for database before starting server"
    python3 "${MANAGE_PY}" wait_for_db

    echo "Checking and applying pending migrations"
    python3 "${MANAGE_PY}" runmigrations

    ensure_backend_translations

    if needs_static_sync; then
        echo "Synchronizing static files for image ${runtime_sha}"
        python3 "${MANAGE_PY}" collectstatic --noinput --verbosity 0 --clear
        python3 "${MANAGE_PY}" collectplugins
        printf '%s' "${runtime_sha}" > "${STATIC_SYNC_MARKER}"
    else
        echo "Static files already synchronized for image ${runtime_sha}"
    fi

    printf '%s' "${runtime_sha}" > "${STARTUP_MARKER}"
}

wait_for_server_preflight() {
    local runtime_sha
    local startup_sha
    local marker_mtime
    local attempts=0
    local max_attempts="${INVENTREE_STARTUP_WAIT_ATTEMPTS:-120}"
    local wait_seconds="${INVENTREE_STARTUP_WAIT_SECONDS:-2}"
    local wait_started

    runtime_sha="$(get_runtime_sha)"
    wait_started="$(date +%s)"

    echo "Waiting for server startup marker ${runtime_sha}"

    while true; do
        if [[ -f "${STARTUP_MARKER}" ]]; then
            startup_sha="$(tr -d '\r\n' < "${STARTUP_MARKER}")"
            marker_mtime="$(get_file_mtime "${STARTUP_MARKER}" || printf '0')"

            if [[ "${startup_sha}" == "${runtime_sha}" ]] && (( marker_mtime >= wait_started )); then
                echo "Server startup marker confirmed for image ${runtime_sha}"
                return 0
            fi
        fi

        attempts=$((attempts + 1))

        if (( attempts >= max_attempts )); then
            echo "Timed out waiting for server startup marker ${runtime_sha}"
            exit 1
        fi

        sleep "${wait_seconds}"
    done
}

case "$*" in
    *gunicorn*)
        run_server_preflight
        ;;
    "invoke worker"*)
        wait_for_server_preflight
        ;;
esac

# Launch the CMD *after* the ENTRYPOINT completes
exec "$@"
