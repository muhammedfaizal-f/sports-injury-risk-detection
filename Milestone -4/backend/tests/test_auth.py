def test_register_and_login(client):
    res = client.post("/auth/register", json={
        "full_name": "Test Athlete",
        "email": "test@athlete.com",
        "password": "testpass123",
        "role": "athlete",
    })
    assert res.status_code == 200
    assert res.json()["email"] == "test@athlete.com"

    res2 = client.post("/auth/login", data={"username": "test@athlete.com", "password": "testpass123"})
    assert res2.status_code == 200
    assert "access_token" in res2.json()


def test_login_wrong_password(client):
    client.post("/auth/register", json={
        "full_name": "Test", "email": "a@a.com", "password": "correctpass", "role": "athlete",
    })
    res = client.post("/auth/login", data={"username": "a@a.com", "password": "wrongpass"})
    assert res.status_code == 401


def test_duplicate_email_rejected(client):
    payload = {"full_name": "Test", "email": "dup@a.com", "password": "pass123", "role": "athlete"}
    client.post("/auth/register", json=payload)
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 400