!macro customCheckAppRunning
  ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
  ${if} $R0 == 0
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK perzikeDoStopProcess
    Quit

    perzikeDoStopProcess:
      DetailPrint "$(appClosing)"
      ${nsProcess::CloseProcess} "${APP_EXECUTABLE_FILENAME}" $R0
      Sleep 1000
      StrCpy $R1 0

    perzikeCheckProcessLoop:
      IntOp $R1 $R1 + 1
      ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
      ${if} $R0 == 0
        ${nsProcess::KillProcess} "${APP_EXECUTABLE_FILENAME}" $R0
        Sleep 1000
        ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
        ${if} $R0 == 0
          DetailPrint `Waiting for "${PRODUCT_NAME}" to close.`
          Sleep 2000
        ${else}
          Goto perzikeProcessNotRunning
        ${endIf}
      ${else}
        Goto perzikeProcessNotRunning
      ${endIf}

      ${if} $R1 > 1
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY perzikeCheckProcessLoop
        Quit
      ${else}
        Goto perzikeCheckProcessLoop
      ${endIf}

    perzikeProcessNotRunning:
  ${endIf}
!macroend

!macro customInstall
  ${ifNot} ${isUpdated}
    CreateShortcut "$DESKTOP\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe"
  ${endIf}
!macroend

!macro customUnInstall
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File /oname=perzike-uninstall-service.ps1 "${BUILD_RESOURCES_DIR}\windows\uninstall-service.ps1"

  StrCpy $R1 ""
  ${if} ${isUpdated}
    StrCpy $R1 "-StopOnly"
  ${endIf}

  nsExec::ExecToLog `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\perzike-uninstall-service.ps1" $R1`
  Pop $R0
  ${if} $R0 != 0
    MessageBox MB_OK|MB_ICONSTOP "Unable to clean up the Perzike service. Close Services and retry with administrator permission." /SD IDOK
    Abort
  ${endIf}
!macroend
