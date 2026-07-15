"""Minimal Vercel Python test - no frameworks"""
def handler(request):
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": '{"status":"ok","version":"test-python"}',
    }