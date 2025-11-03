!macro _KillIfRunning _PROC
  ; 尝试强制结束指定进程（忽略错误）
  nsExec::ExecToStack 'taskkill /F /IM "${_PROC}" /T'
!macroend

!macro customInit
  ; 安装开始前，尝试结束正在运行的应用和子进程
  !insertmacro _KillIfRunning "YoloMarkFlow.exe"
  !insertmacro _KillIfRunning "yolomarkflow.exe"
  !insertmacro _KillIfRunning "inference_server.exe"
  !insertmacro _KillIfRunning "train.exe"
  !insertmacro _KillIfRunning "inference.exe"
  !insertmacro _KillIfRunning "python.exe"
  
  ; 如果是更新安装（安装目录已存在），保留用户数据
  ; 用户数据目录 D:\YoloMarkFlow 在安装目录外，不会被删除
  ; 这里只需要确保更新时不清空安装目录下的非应用文件（如果有的话）
!macroend

!macro customInstallMode
  ; 设置安装模式为更新模式（如果已安装）
  ; 这样 NSIS 会保留已有文件，只更新应用文件
  ; electron-builder 默认已处理，这里确保行为正确
!macroend

!macro customUnInstall
  ; 卸载开始前，同样强制结束进程，避免文件被占用
  !insertmacro _KillIfRunning "YoloMarkFlow.exe"
  !insertmacro _KillIfRunning "yolomarkflow.exe"
  !insertmacro _KillIfRunning "inference_server.exe"
  !insertmacro _KillIfRunning "train.exe"
  !insertmacro _KillIfRunning "inference.exe"
  !insertmacro _KillIfRunning "python.exe"
!macroend


