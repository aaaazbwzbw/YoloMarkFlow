!macro _KillIfRunning _PROC
  nsExec::ExecToStack 'taskkill /F /IM "${_PROC}" /T'
!macroend

!include "FileFunc.nsh"
!include "LogicLib.nsh"

; 声明全局变量
Var IsUpdateMode

; ===== 最关键的宏：在 .onInit 开始时执行 =====
!macro customInit
  ; ===== 第一步：强制关闭所有进程 =====
  !insertmacro _KillIfRunning "YoloMarkFlow.exe"
  !insertmacro _KillIfRunning "yolomarkflow.exe"
  !insertmacro _KillIfRunning "inference_server.exe"
  !insertmacro _KillIfRunning "train.exe"
  !insertmacro _KillIfRunning "inference.exe"
  !insertmacro _KillIfRunning "python.exe"
  
  ; ===== 第二步：检测是否已安装 =====
  StrCpy $IsUpdateMode "0"
  
  ; 检查注册表
  SetRegView 64
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "InstallLocation"
  
  ${If} $0 != ""
    ; 检测到已安装 - 静默更新模式
    StrCpy $IsUpdateMode "1"
    StrCpy $INSTDIR $0
    
    ; 设置覆盖模式，直接更新，不询问
    SetOverwrite on
  ${EndIf}
!macroend

!macro preInit
  ; 预初始化阶段
  SetOverwrite on
!macroend

!macro customInstallMode
  ; 安装模式选择
  ${If} $IsUpdateMode == "1"
    ; 更新模式：使用已安装的目录
    ; 不显示目录选择页面
  ${EndIf}
!macroend

!macro customInstall
  ; ===== 安装文件阶段 =====
  ; electron-builder 的 File 指令只会包含程序文件
  ; 不包含用户数据，因此用户数据不会被删除
  
  ${If} $IsUpdateMode == "1"
    DetailPrint "===== 更新模式 ====="
    DetailPrint "只更新程序文件"
    DetailPrint "保留：plugins/, models/, *.log, *.db, 用户数据等"
  ${EndIf}
  
  ; 确保使用覆盖模式
  SetOverwrite on
  SetOutPath "$INSTDIR"
!macroend

; ===== 关键：禁用卸载前提示 =====
!macro customRemoveFiles
  ; 这个宏在卸载文件时调用
  ; electron-builder 默认只删除它通过 File 指令安装的文件
  ; 用户创建的文件和目录会被保留
!macroend

!macro customUnInstall
  ; ===== 卸载时执行 =====
  
  ; 关闭进程
  !insertmacro _KillIfRunning "YoloMarkFlow.exe"
  !insertmacro _KillIfRunning "yolomarkflow.exe"
  !insertmacro _KillIfRunning "inference_server.exe"
  !insertmacro _KillIfRunning "train.exe"
  !insertmacro _KillIfRunning "inference.exe"
  !insertmacro _KillIfRunning "python.exe"
  
  ; 询问用户是否保留数据
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "是否保留用户数据？$\n$\n选择'是'：保留插件、模型、数据库等文件$\n选择'否'：删除所有文件（不推荐）" \
    IDYES keep_data
  
  Goto uninstall_end
  
  keep_data:
    DetailPrint "保留用户数据"
  
  uninstall_end:
!macroend
