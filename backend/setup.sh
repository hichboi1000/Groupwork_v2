#!/bin/bash
set -e

echo ""
echo "========================================="
echo "  GroupWork - Backend Setup"
echo "========================================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Install it from https://python.org"
    exit 1
fi

echo "✅ Python found: $(python3 --version)"

cd "$(dirname "$0")/Groupwork"

# Create virtual environment
echo ""
echo "→ Creating virtual environment..."
python3 -m venv venv

# Activate it
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null

echo "✅ Virtual environment activated"

# Install dependencies
echo ""
echo "→ Installing Python packages..."
pip install -r ../requirements.txt --quiet

echo "✅ Packages installed"

# Run migrations
echo ""
echo "→ Setting up the database..."
python manage.py makemigrations users groups assignments tasks notifications --no-input
python manage.py migrate --no-input

echo "✅ Database ready"

# Create superuser
echo ""
echo "→ Creating admin account..."
echo ""
python manage.py shell -c "
from users.models import User
if not User.objects.filter(username='admin').exists():
    u = User.objects.create_superuser('admin', 'admin@groupwork.local', 'admin1234')
    u.role = 'lecturer'
    u.first_name = 'Admin'
    u.last_name = 'User'
    u.save()
    print('✅ Admin account created: username=admin password=admin1234')
else:
    print('ℹ️  Admin account already exists')
"

echo ""
echo "========================================="
echo "  Setup complete!"
echo ""
echo "  To start the backend server:"
echo "    cd Groupwork"
echo "    source venv/bin/activate   (Mac/Linux)"
echo "    venv\\Scripts\\activate     (Windows)"
echo "    python manage.py runserver"
echo ""
echo "  Server will run at: http://localhost:8000"
echo "  Django admin:       http://localhost:8000/admin"
echo "  Login:              admin / admin1234"
echo "========================================="
