@echo off
echo =============================================
echo  GroupWork - Backend Setup (Windows)
echo =============================================

cd backend\Groupwork

echo Installing Python dependencies...
pip install -r requirements.txt

echo Running migrations...
python manage.py makemigrations users
python manage.py makemigrations groups
python manage.py makemigrations assignments
python manage.py makemigrations tasks
python manage.py makemigrations notifications
python manage.py migrate

echo Creating Django admin superuser...
python manage.py createsuperuser

echo Loading demo data...
python manage.py shell < seed.py

echo.
echo =============================================
echo  Backend ready! Start it with:
echo  python manage.py runserver
echo =============================================
pause
