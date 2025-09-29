from faker import Faker
import random
import csv

fake = Faker("en_IN")  # Indian-style names
domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "rediffmail.com"]

def make_email(name):
    """
    Turn a full name into a plausible email local-part.
    """
    parts = name.lower().replace(".", "").split()
    # keep only alphabetic chars in each part
    parts = ["".join(ch for ch in p if ch.isalpha()) for p in parts]
    if not parts:
        local = fake.user_name()
    else:
        first = parts[0]
        last = parts[1] if len(parts) > 1 else ""
        num = str(random.randint(1, 99))

        patterns = [
            "{first}.{last}",
            "{first}{last}",
            "{first}_{last}",
            "{first}{num}",
            "{first}.{num}{last}"
        ]
        pattern = random.choice(patterns)
        local = pattern.format(first=first, last=last, num=num).strip("._")

    domain = random.choice(domains)
    return f"{local}@{domain}"

def generate_emails(n=100):
    emails = []
    for _ in range(n):
        name = fake.name()  # e.g., "Rajesh Kumar"
        email = make_email(name)
        emails.append(email)
    return emails

if __name__ == "__main__":
    emails = generate_emails(100)

    # Save to CSV
    with open("emails.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Email"])
        for e in emails:
            writer.writerow([e])
    print("Saved 100 emails to emails.csv")

    # Also print to console
    for e in emails:
        print(e)
