@echo off
setlocal

:: Pardur App - Production Startup
:: Builds a fresh JAR from source, then starts the app on port 3000.
:: URL: http://vio-private.dyndns.org:3000/
::
:: Requirements on this machine:
::   - Java 21  (java -version)
::   - Maven 3.x on PATH  (mvn -version)
::
:: Set your database credentials below before first run.

:: --- Database credentials ---
set DB_HOST=localhost
set DB_PORT=3306
set DB_NAME=item_management
set DB_USER=root
set DB_PASSWORD=02SL20

:: --- App port ---
set PORT=3000

:: --- Explicit tool paths ---
set MVN=F:\_Servers\Webserver\apache-maven-3.9.14\bin\mvn.cmd

echo.
echo  Pardur App - Production Startup
echo  ========================================================
echo.

echo  Checking Java...
java -version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Java not found. Install Java 21 and add it to PATH.
    echo  Download: https://adoptium.net/
    pause
    exit /b 1
)
echo  Java OK.

echo  Checking Maven...
call "%MVN%" -version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Maven not found. Install Maven 3.x and add it to PATH.
    echo  Download: https://maven.apache.org/download.cgi
    pause
    exit /b 1
)
echo  Maven OK.

echo  Building JAR from source...
echo.
cd /d "%~dp0backend"
call "%MVN%" clean package -Dmaven.test.skip=true
if errorlevel 1 (
    echo.
    echo  ERROR: Build failed. See output above.
    pause
    exit /b 1
)

set JAR=target\pardur-app-0.0.1-SNAPSHOT.jar
if not exist "%JAR%" (
    echo  ERROR: JAR not found at backend\%JAR%
    pause
    exit /b 1
)

echo.
echo  Build successful.
echo  Starting app on http://vio-private.dyndns.org:%PORT%/
echo  Press Ctrl+C to stop.
echo  ========================================================
echo.

java -Dspring.profiles.active=prod ^
     -DPORT=%PORT% ^
     -DDB_HOST=%DB_HOST% ^
     -DDB_PORT=%DB_PORT% ^
     -DDB_NAME=%DB_NAME% ^
     -DDB_USER=%DB_USER% ^
     -DDB_PASSWORD=%DB_PASSWORD% ^
     -jar "%JAR%"

pause
