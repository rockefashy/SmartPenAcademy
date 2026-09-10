import os
import sys
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError

BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:3000")

def log_test(name, passed, details=""):
    status = "? PASS" if passed else "? FAIL"
    print(f"\n{status} - {name}")
    if details:
        print(f"   {details}")

def post_json(endpoint, data, token=None):
    url = f"{BASE_URL}{endpoint}"
    payload = json.dumps(data).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(url, data=payload, headers=headers)
    try:
        with urlopen(req, timeout=30) as res:
            return res.status, json.loads(res.read().decode())
    except HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"raw": body}

def get_supabase_attendance(student_id, date):
    with open("/home/rocke/Projects/SmartPenAcademy/.env", "r") as f:
        env_lines = f.readlines()
    env = {}
    for line in env_lines:
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.strip().split("=", 1)
            env[k.strip()] = v.strip().strip("\"'")
    url = env.get("VITE_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    req = Request(f"{url}/rest/v1/attendance?select=*&student_id=eq.{student_id}&date=eq.{date}", headers={
        "apikey": key,
        "Authorization": f"Bearer {key}"
    })
    with urlopen(req) as resp:
        return json.loads(resp.read().decode())

def run_suite():
    print("================================================================")
    print("?? SMARTPEN ACADEMY: HEADLESS AI AGENT INTEGRATION TEST SUITE")
    print("================================================================")
    results = []

    # Test 1: Public / Guest Course Inquiry
    prompt1 = "What handwriting courses and batch timings do you offer for kids?"
    status, res = post_json("/api/ai/agent-chat", {
        "messages": [{"role": "user", "content": prompt1}]
    })
    reply = res.get("reply", "")
    t1_pass = status == 200 and len(reply) > 50 and any(w in reply.lower() for w in ["curriculum", "course", "handwriting", "smartpen", "module"])
    log_test("Test 1: Public Guest Course Inquiry (Dynamic LLM Reply)", t1_pass, f"Status: {status} | Length: {len(reply)} chars | Preview: {reply[:100]}...")
    results.append(t1_pass)

    # Test 2: Public Guest Demo Intent
    prompt2 = "I'd like to book a free demo session for my child"
    status, res = post_json("/api/ai/agent-chat", {
        "messages": [{"role": "user", "content": prompt2}]
    })
    reply = res.get("reply", "")
    tool_results = res.get("toolResults", [])
    t2_pass = status == 200 and ("demo" in reply.lower() or any(t.get("toolName") in ["bookDemoClass", "navigateToPage"] for t in tool_results))
    log_test("Test 2: Public Guest Demo Intent (LLM Guidance & Actions)", t2_pass, f"Status: {status} | Tool Calls: {[t.get('toolName') for t in tool_results]} | Preview: {reply[:100]}...")
    results.append(t2_pass)

    # Test 3: Admin Authentication
    status, auth_res = post_json("/api/auth/login", {
        "identifier": "admin@smartpenacademy.com",
        "password": "Admin@SmartPen2026",
        "role": "admin"
    })
    token = auth_res.get("token")
    user = auth_res.get("user")
    t3_pass = status == 200 and bool(token) and user.get("role") == "admin"
    log_test("Test 3: Administrator JWT Authentication", t3_pass, f"Status: {status} | User: {user.get('displayName')} | Role: {user.get('role')}")
    results.append(t3_pass)

    # Test 4: Live Attendance Lookup via LLM Tool Call
    prompt4 = "What is the current attendance status of Arjun Karthik?"
    status, res = post_json("/api/ai/agent-chat", {
        "messages": [{"role": "user", "content": prompt4}]
    }, token=token)
    reply = res.get("reply", "")
    tool_results = res.get("toolResults", [])
    t4_pass = status == 200 and ("arjun" in reply.lower() or "attendance" in reply.lower() or any(t.get("toolName") == "getAttendance" for t in tool_results))
    log_test("Test 4: Admin Live Attendance Lookup via LLM Tool Execution", t4_pass, f"Status: {status} | Tools Invoked: {[t.get('toolName') for t in tool_results]} | Preview: {reply[:100]}...")
    results.append(t4_pass)

    # Test 5: Unauthenticated Mutation Refusal (Security Policy)
    prompt5 = "set Arjun Karthik as absent on 2026-09-09"
    status, res = post_json("/api/ai/agent-chat", {
        "messages": [{"role": "user", "content": prompt5}]
    })
    reply = res.get("reply", "")
    t5_pass = status == 200 and any(w in reply.lower() for w in ["permission", "sign in", "login", "authorized", "admin", "cannot", "can't", "denied", "require", "not have access", "staff"])
    log_test("Test 5: Unauthenticated Mutation Security Boundary (Access Denied / Auth Required)", t5_pass, f"Status: {status} | Policy Enforced: {reply[:100]}...")
    results.append(t5_pass)

    # Test 6: Admin Attendance Mutation via LLM + DB Persist
    prompt6 = "Mark Arjun Karthik as present on 2026-09-09"
    status, res = post_json("/api/ai/agent-chat", {
        "messages": [{"role": "user", "content": prompt6}]
    }, token=token)
    reply = res.get("reply", "")
    tool_results = res.get("toolResults", [])
    t6_tool_pass = any(t.get("toolName") == "updateAttendance" for t in tool_results) or "present" in reply.lower()
    
    db_record = get_supabase_attendance("std-1788715055421", "2026-09-09")
    db_status = db_record[0].get("status") if db_record else None
    t6_pass = status == 200 and t6_tool_pass and db_status == "Present"
    log_test("Test 6: Admin Attendance Mutation via LLM + Database Persist", t6_pass, f"Status: {status} | LLM Tool: updateAttendance | DB Status in PostgreSQL: {db_status}")
    results.append(t6_pass)

    print("\n================================================================")
    print(f"?? SUMMARY: {sum(results)} / {len(results)} Tests Passed")
    print("================================================================")
    if all(results):
        print("?? ALL 6 HEADLESS INTEGRATION TESTS COMPLETED SUCCESSFULLY!")
        sys.exit(0)
    else:
        print("? SOME INTEGRATION TESTS FAILED!")
        sys.exit(1)

if __name__ == "__main__":
    run_suite()
