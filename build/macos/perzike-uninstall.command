#!/bin/sh
set -eu

PATH='/usr/bin:/bin:/usr/sbin:/sbin'
export PATH

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
case "$SCRIPT_DIR" in
    */Perzike.app/Contents/Resources)
        APP_PATH="${SCRIPT_DIR%/Contents/Resources}" ;;
    *) APP_PATH="${1:-/Applications/Perzike.app}" ;;
esac

if [ "$(id -u)" != 0 ]; then
    exec sudo /bin/sh "$0" "$APP_PATH"
fi

case "$APP_PATH" in
    /*/Perzike.app) ;;
    *) echo 'Expected an absolute path to Perzike.app.' >&2; exit 1 ;;
esac

if [ -e "$APP_PATH" ]; then
    bundle_id="$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP_PATH/Contents/Info.plist")"
    if [ "$bundle_id" != 'perzike.app' ]; then
        echo 'The selected application is not Perzike; nothing was removed.' >&2
        exit 1
    fi
fi

if pgrep -x Perzike >/dev/null 2>&1; then
    echo 'Quit Perzike, then run this uninstaller again.' >&2
    exit 1
fi

remove_launchd_service() {
    label="$1"
    if launchctl print "system/$label" >/dev/null 2>&1; then
        if ! launchctl bootout "system/$label"; then
            if launchctl print "system/$label" >/dev/null 2>&1; then
                echo "Failed to unload $label; the application was kept." >&2
                return 1
            fi
        fi
    fi
    rm -f "/Library/LaunchDaemons/$label.plist"
}

remove_launchd_service PerzikeService
remove_launchd_service perzike.helper
rm -f /Library/PrivilegedHelperTools/perzike.helper \
    /tmp/perzike.helper /tmp/perzike-helper.sock /tmp/perzike-service.sock

if [ -e "$APP_PATH" ]; then
    rm -rf "$APP_PATH"
fi
pkgutil --forget perzike.app >/dev/null 2>&1 || true
echo 'Perzike and its system service have been removed. User settings were kept.'
