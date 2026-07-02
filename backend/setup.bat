@echo off
echo.
echo =========================================
echo   GroupWork - Backend Setup (Windows)
echo =========================================
echo.

cd /d "%~dp0Groupwork"

echo - Creating virtual environment...
python -m venv venv

echo - Activating...
call venv\Scripts\activate.bat

echo - Installing packages...
pip install -r ..\requirements.txt

echo - Setting up database...
python manage.py makemigrations users groups assignments tasks notifications
python manage.py migrate

echo - Creating admin account...
python manage.py shell -c "from users.models import User; u=User.objects.create_superuser('admin','admin@gw.local','admin1234') if not User.objects.filter(username='admin').exists() else None; u and setattr(u,'role','lecturer') or u and u.save()"

echo.
echo =========================================
echo   Done! Run the server with:
echo   cd Groupwork
echo   venv\Scripts\activate
echo   python manage.py runserver
echo =========================================
pause
