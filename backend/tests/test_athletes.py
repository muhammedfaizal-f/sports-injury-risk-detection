def _register_and_login(client, email="athlete@test.com"):
    client.post("/auth/register", json={
        "full_name": "Athlete One", "email": email, "password": "pass123", "role": "athlete",
    })
    res = client.post("/auth/login", data={"username": email, "password": "pass123"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_and_get_profile(client):
    headers = _register_and_login(client)

    res = client.post("/athletes/me", json={"sport_type": "Football", "age": 22}, headers=headers)
    assert res.status_code == 200
    assert res.json()["sport_type"] == "Football"

    res2 = client.get("/athletes/me", headers=headers)
    assert res2.status_code == 200
    assert res2.json()["age"] == 22


def test_get_profile_without_creating(client):
    headers = _register_and_login(client)
    res = client.get("/athletes/me", headers=headers)
    assert res.status_code == 404


def test_update_profile(client):
    headers = _register_and_login(client)
    client.post("/athletes/me", json={"sport_type": "Basketball"}, headers=headers)
    res = client.put("/athletes/me", json={"sport_type": "Athletics"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["sport_type"] == "Athletics"


def test_non_athlete_cannot_create_profile(client):
    client.post("/auth/register", json={
        "full_name": "Coach One", "email": "coach@test.com", "password": "pass123", "role": "coach",
    })
    res = client.post("/auth/login", data={"username": "coach@test.com", "password": "pass123"})
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}

    res2 = client.post("/athletes/me", json={"sport_type": "Football"}, headers=headers)
    assert res2.status_code == 403