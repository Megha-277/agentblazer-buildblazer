"""
AgentBlazer Club — Database Seeder
Inserts initial seed events and team members using the service_role key.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    exit(1)

client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

SEED_EVENTS = [
    {
        "title": "Master the Future: A Hands-on GSoC & LLMs Workshop",
        "event_date": "February 14, 2026",
        "kind": "Flagship Masterclass",
        "description": "Practical masterclass on open-source Git PR workflows, Retrieval-Augmented Generation (RAG), Gemini AI, LangChain, LlamaIndex, CrewAI, and live Gradio prototyping.",
        "tracks": [],
        "is_published": True,
    },
    {
        "title": "PROMPT OPS-2K26 Challenge",
        "event_date": "March 25, 2026",
        "kind": "Live Contest",
        "description": "Fast-paced prompt engineering hackathon featuring automated test suites, iterative refinement, teamwork, and live algorithmic problem solving.",
        "tracks": ["Track 1: 1st Year Engineers", "Track 2: 2nd Year Engineers"],
        "is_published": True,
    },
    {
        "title": "Agentforce Technical Deep-Dive",
        "event_date": "August 25, 2025",
        "kind": "Symposium Keynote",
        "description": "Guiding undergraduate engineers from prompt prediction to autonomous agentic architectures, Salesforce Data Cloud integration, and real-time enterprise workflows.",
        "tracks": [],
        "is_published": True,
    },
    {
        "title": "Demystifying Generative Models",
        "event_date": "March 18, 2026",
        "kind": "Student Lab",
        "description": "Exploring Transformer mechanics, multi-agent consensus networks, and comparative latency benchmarks of LLaMA, Groq, and Mistral architectures.",
        "tracks": [],
        "is_published": True,
    },
    {
        "title": "Cyber Security & Career Pathways",
        "event_date": "April 01, 2026",
        "kind": "Security Workshop",
        "description": "Interactive demonstrations covering Shodan discovery, OSINT methods, CVE vulnerability analysis, SQL injection scenarios, and the Cyber Kill Chain.",
        "tracks": [],
        "is_published": True,
    },
    {
        "title": "Hands-on Agentforce & AI Agents",
        "event_date": "May 22, 2026",
        "kind": "Developer Lab",
        "description": "Applied development lab creating Flex Prompts, dynamic contextual Sales Email templates, and autonomous event triggers within modern CRM pipelines.",
        "tracks": [],
        "is_published": True,
    }
]

SEED_TEAM = [
    {"name": "Mr. Santosh Rebello", "role_title": "Guest of Honor · Keynote Speaker", "bio": "Salesforce", "display_order": 1, "is_active": True},
    {"name": "Mr. Stephen Pinto", "role_title": "Technical Mentor · Alumni Guide", "bio": "Salesforce & SJEC Alumnus", "display_order": 2, "is_active": True},
    {"name": "Dr. Rio D’Souza", "role_title": "Patron · Presidential Address", "bio": "Principal, SJEC", "display_order": 3, "is_active": True},
    {"name": "Dr. Melwyn D’Souza", "role_title": "Program Chair · Department Head", "bio": "HOD, Computer Science & Engg", "display_order": 4, "is_active": True},
    {"name": "Ms. Nisha Roche", "role_title": "Assistant Professor, CSE · Faculty Coordinator", "bio": "Department Coordinator", "display_order": 5, "is_active": True},
    {"name": "Mr. Keith Fernandes", "role_title": "Assistant Professor, CSE · Faculty Coordinator", "bio": "Department Coordinator", "display_order": 6, "is_active": True},
    {"name": "Ruben Saldanha", "role_title": "President", "bio": "Guiding club vision, university collaborations, and strategic workshop series.", "display_order": 10, "is_active": True},
    {"name": "Ajay Preenal Dsouza", "role_title": "Vice President", "bio": "Coordinating student mentorship, event operations, and community growth.", "display_order": 11, "is_active": True},
    {"name": "Stevin Dsouza", "role_title": "Tech Lead", "bio": "Technical architectures, hands-on lab environments, and repository supervision.", "display_order": 12, "is_active": True},
    {"name": "Frenny Chrystal Saldanha", "role_title": "Resource Head", "bio": "Managing cloud compute budgets, venue infrastructure, and participant toolkits.", "display_order": 13, "is_active": True},
    {"name": "Joyline Galbao", "role_title": "Secretary", "bio": "Documentation, accreditation reporting, meeting minutes, and member onboarding.", "display_order": 14, "is_active": True},
    {"name": "Chinthan N V", "role_title": "Media Head", "bio": "Brand storytelling, photo documentation, visual design, and social publications.", "display_order": 15, "is_active": True},
    {"name": "Prajwal Royston Cordiero", "role_title": "AI & LLM Research Group", "bio": "Working Committee", "display_order": 20, "is_active": True},
    {"name": "Chacko P Abraham", "role_title": "Model Evaluation Benchmarks", "bio": "Working Committee", "display_order": 21, "is_active": True},
    {"name": "Alma Roxane Pereira", "role_title": "Project Operations & Labs", "bio": "Working Committee", "display_order": 22, "is_active": True},
]

def seed():
    print("Checking events table...")
    ev_res = client.table("events").select("id").limit(1).execute()
    if not ev_res.data:
        print(f"Seeding {len(SEED_EVENTS)} events...")
        for ev in SEED_EVENTS:
            client.table("events").insert(ev).execute()
        print("Events seeded successfully.")
    else:
        print("Events already exist, skipping seed.")

    print("Checking team_members table...")
    team_res = client.table("team_members").select("id").limit(1).execute()
    if not team_res.data:
        print(f"Seeding {len(SEED_TEAM)} team members...")
        for tm in SEED_TEAM:
            client.table("team_members").insert(tm).execute()
        print("Team members seeded successfully.")
    else:
        print("Team members already exist, skipping seed.")

if __name__ == "__main__":
    seed()
