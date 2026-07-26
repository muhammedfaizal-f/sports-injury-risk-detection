import io


def _athlete_with_profile(client):
    client.post("/auth/register", json={
        "full_name": "Video Tester", "email": "video@test.com", "password": "pass123", "role": "athlete",
    })
    res = client.post("/auth/login", data={"username": "video@test.com", "password": "pass123"})
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
    client.post("/athletes/me", json={"sport_type": "Football"}, headers=headers)
    return headers


def test_upload_rejects_bad_extension(client):
    headers = _athlete_with_profile(client)
    fake_file = io.BytesIO(b"not a real video")
    res = client.post(
        "/videos/upload",
        files={"file": ("test.txt", fake_file, "text/plain")},
        data={"activity_type": "Running"},
        headers=headers,
    )
    assert res.status_code == 400


def test_my_videos_empty_initially(client):
    headers = _athlete_with_profile(client)
    res = client.get("/videos/mine", headers=headers)
    assert res.status_code == 200
    assert res.json() == []