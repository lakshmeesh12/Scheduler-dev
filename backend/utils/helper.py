import re
from dateutil import parser
from dateutil.relativedelta import relativedelta


def compute_duration(start: str, end: str) -> float:
    try:
        start = re.sub("[^A-Za-z0-9]+"," ",start) if start else ""
        end = re.sub("[^A-Za-z0-9]+"," ",end) if end else ""
        years = 0

        if start and end:
            start_date = parser.parse(start)
            end_date = parser.parse("Aug 2025") if (end.lower() in ["present", "current"]) else parser.parse(end)
            diff = relativedelta(end_date, start_date)
            total_months = diff.years * 12 + diff.months

            years = round(total_months / 12, 1)

        return years
    except Exception as err:
        print(err)
        print(end)
        return 0
