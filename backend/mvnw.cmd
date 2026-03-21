@REM ----------------------------------------------------------------------------
@REM Apache Maven Wrapper startup batch script, version 3.3.2
@REM ----------------------------------------------------------------------------

@REM Begin all REM://s that are comments and SAY://s for output
@echo off

@REM Set local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" setlocal

set WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain

@REM Find the project base dir, i.e. the directory that contains the folder ".mvn".
set MAVEN_PROJECTBASEDIR=%~dp0
:findBaseDir
IF EXIST "%MAVEN_PROJECTBASEDIR%\.mvn" goto baseDirFound
cd ..
IF "%MAVEN_PROJECTBASEDIR%"=="%CD%" goto baseDirNotFound
set MAVEN_PROJECTBASEDIR=%CD%
goto findBaseDir

:baseDirNotFound
set MAVEN_PROJECTBASEDIR=%~dp0

:baseDirFound

@REM Detect Maven install
set MVNW_REPOURL=https://repo.maven.apache.org/maven2
set MVNW_MVN_VERSION=3.9.11

@REM Try to use local Maven installation first
for /f "tokens=*" %%i in ('where mvn 2^>nul') do set "MVN_CMD=%%i"
if defined MVN_CMD goto :runMaven

@REM Check wrapper dist
set "WRAPPER_DIST=%USERPROFILE%\.m2\wrapper\dists\apache-maven-%MVNW_MVN_VERSION%"
for /f "tokens=*" %%d in ('dir /b /ad "%WRAPPER_DIST%" 2^>nul') do (
    if exist "%WRAPPER_DIST%\%%d\bin\mvn.cmd" (
        set "MVN_CMD=%WRAPPER_DIST%\%%d\bin\mvn.cmd"
        goto :runMaven
    )
)

@REM Download Maven if not found
echo Maven not found. Please install Maven 3.9+ or run: winget install Apache.Maven
exit /b 1

:runMaven
"%MVN_CMD%" %*
