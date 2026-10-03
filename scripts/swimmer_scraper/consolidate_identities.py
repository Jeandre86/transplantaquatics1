"""Consolidate only high-confidence repeat swimmer identities in the review export."""
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPORT = ROOT / 'data/swimming/swimmers.json'
OVERRIDES = ROOT / 'data/swimming/identity-overrides.json'

def load_overrides():
    try:
        return json.loads(OVERRIDES.read_text()).get('confirmed_person_groups', [])
    except (OSError, ValueError):
        return []

def norm(value):
    return re.sub(r'[^\w]+', '', unicodedata.normalize('NFKD', value or '').encode('ascii', 'ignore').decode().casefold())

def bounds(result):
    match = re.fullmatch(r'(\d+)\s*-\s*(\d+)', result.get('age_group') or '')
    year = result.get('year')
    if not match or not isinstance(year, int):
        return None
    youngest, oldest = int(match[1]), int(match[2])
    if youngest > oldest:
        youngest, oldest = oldest, youngest
    return year - oldest - 1, year - youngest

def identity_bounds(swimmer):
    ranges = [bounds(result) for result in swimmer.get('results', [])]
    ranges = [item for item in ranges if item]
    if not ranges:
        return None
    # Conflicting source ages make an identity unsafe for automatic merging.
    low, high = max(item[0] for item in ranges), min(item[1] for item in ranges)
    return (low, high) if low <= high else 'conflict'

TEAM_ALIASES = {
    # Historical results use several spellings for the same national teams.
    'GBR': {'greatbrit', 'greatbritain', 'greatbritainni', 'greatbritainnorthireland', 'greatbrittanni', 'greatbrittan', 'gbni', 'uk', 'unitedkingdom'},
    'AUS': {'australia', 'aus'},
    'USA': {'usa', 'unitedstates', 'unitedstatesofamerica'},
    'NZL': {'newzealand', 'nzl'},
    'IRL': {'ireland', 'ire'},
    'HUN': {'hungary', 'hun'},
    'GER': {'germany', 'ger'},
    'FRA': {'france', 'fra'},
    'ITA': {'italy', 'ita'},
    'NED': {'netherlands', 'thenetherlands', 'ned'},
    'CZE': {'czechrepublic', 'czechia', 'cze'},
    'AUT': {'austria', 'aut'},
    'CAN': {'canada', 'can'},
    'RSA': {'southafrica', 'rsa'},
}

def team_keys(swimmer):
    country_code = swimmer.get('country_code')
    aliases = TEAM_ALIASES.get(country_code, set())
    keys = {norm(team) for team in swimmer.get('teams', []) if norm(team)}
    # Normalize explicit country/team spellings only. Regional teams remain
    # distinct, so a shared country alone cannot create a match.
    if keys & aliases:
        keys.add(f'country:{country_code}')
    return keys

def meets(swimmer):
    return {result.get('meet_id') for result in swimmer.get('results', []) if result.get('meet_id')}

def compatible(left, right):
    if not left.get('country_code') or left.get('country_code') != right.get('country_code'):
        return False
    if not left.get('gender') or left.get('gender') != right.get('gender'):
        return False
    if not (team_keys(left) & team_keys(right)):
        return False
    left_age, right_age = identity_bounds(left), identity_bounds(right)
    if left_age == 'conflict' or right_age == 'conflict':
        return False
    if left_age and right_age:
        if max(left_age[0], right_age[0]) > min(left_age[1], right_age[1]):
            return False
        # Same-meet entries can be separate event rows for one swimmer. A
        # conflicting duplicate event is evidence of a possible namesake.
        def result_key(result):
            return tuple(norm(str(result.get(field) or '')) for field in ('meet_id','event','gender','age_group','course'))
        left_results = {result_key(row): row for row in left.get('results', [])}
        right_results = {result_key(row): row for row in right.get('results', [])}
        for key in left_results.keys() & right_results.keys():
            a, b = left_results[key], right_results[key]
            if (a.get('time_ms') and b.get('time_ms') and a.get('time_ms') != b.get('time_ms')) or (place_key(a) != place_key(b) and place_key(a) != float('inf') and place_key(b) != float('inf')):
                return False
        return True
    # One age-less historical profile can attach to one known-age profile with
    # matching full name, country, gender and team. Two age-less profiles never
    # merge automatically across meets.
    return bool(left_age) != bool(right_age)

def time_key(result):
    value = result.get('time_ms')
    return value if isinstance(value, (int, float)) else float('inf')

def place_key(result):
    value = result.get('placing_original')
    match = re.match(r'\s*(\d+)', str(value or ''))
    return int(match[1]) if match else float('inf')

def merge_result(left, right):
    # Keep one result per swimmer, meet, event, age, gender and course. Prefer
    # finals, then the better place, then the fastest valid time.
    key = lambda item: tuple(norm(str(item.get(field) or '')) for field in ('meet_id','event','gender','age_group','course'))
    merged = {key(row): dict(row) for row in left}
    for row in right:
        row_key = key(row)
        current = merged.get(row_key)
        if current is None:
            merged[row_key] = dict(row)
            continue
        old_rank = (0 if 'final' in norm(current.get('round') or '') else 1, place_key(current), time_key(current))
        new_rank = (0 if 'final' in norm(row.get('round') or '') else 1, place_key(row), time_key(row))
        chosen = dict(row if new_rank < old_rank else current)
        refs = {json.dumps(ref, sort_keys=True): ref for ref in [*(current.get('source_references') or []), *(row.get('source_references') or [])]}
        chosen['source_references'] = list(refs.values())
        merged[row_key] = chosen
    return list(merged.values())

def merge_profiles(keep, other):
    keep['results'] = merge_result(keep.get('results', []), other.get('results', []))
    keep['name_variants'] = sorted(set([*keep.get('name_variants', []), *other.get('name_variants', [])]), key=str.casefold)
    keep['teams'] = sorted(set([*keep.get('teams', []), *other.get('teams', [])]), key=str.casefold)
    keep['years'] = sorted(set([*keep.get('years', []), *other.get('years', [])]))
    keep['categories'] = sorted(set([*keep.get('categories', []), *other.get('categories', [])]))
    keep['source_ids'] = sorted(set([*keep.get('source_ids', []), *other.get('source_ids', [])]))
    keep['source_key_aliases'] = sorted(set([*keep.get('source_key_aliases', []), other['id'], *other.get('source_key_aliases', [])]))
    keep['result_count'] = len(keep['results'])
    return keep

def consolidate(swimmers):
    candidates = defaultdict(list)
    for swimmer in swimmers:
        swimmer.setdefault('source_key_aliases', [])
        swimmer['identity_review_required'] = False
        candidates[(norm(swimmer.get('display_name')), swimmer.get('country_code'), swimmer.get('gender'))].append(swimmer)

    result = []
    merged_count = 0
    for (name_key, country_code, gender), group in candidates.items():
        parent = list(range(len(group)))
        def find(index):
            while parent[index] != index:
                parent[index] = parent[parent[index]]
                index = parent[index]
            return index
        edges = []
        degree = [0] * len(group)
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                if compatible(group[i], group[j]):
                    edges.append((i, j)); degree[i] += 1; degree[j] += 1
        # Merge an unambiguous connected identity cluster when every pair is
        # compatible. This handles one-result-per-event source rows and age
        # progression across meets, while keeping incompatible homonyms apart.
        edge_set = {tuple(sorted(edge)) for edge in edges}
        for i, j in edges:
            a, b = find(i), find(j)
            if a == b:
                continue
            members_a = [n for n in range(len(group)) if find(n) == a]
            members_b = [n for n in range(len(group)) if find(n) == b]
            combined = members_a + members_b
            if all(tuple(sorted((x, y))) in edge_set for pos, x in enumerate(combined) for y in combined[pos + 1:]):
                parent[b] = a
                merged_count += 1
        clusters = defaultdict(list)
        for i, swimmer in enumerate(group):
            clusters[find(i)].append(swimmer)
        for cluster in clusters.values():
            # Prefer the most complete profile, keeping its existing ID stable.
            cluster.sort(key=lambda item: (-len(item.get('results', [])), item['id']))
            primary = cluster[0]
            for extra in cluster[1:]:
                merge_profiles(primary, extra)
            result.append(primary)

    # Apply only explicit, user-confirmed identity decisions after the
    # evidence-based pass. This supports records whose source omitted country
    # or used a club team instead of the national team without weakening the
    # automatic matching rules for everyone else.
    for override in load_overrides():
        name_key = override.get('name_key')
        gender = override.get('gender')
        allowed_countries = set(override.get('country_codes', []))
        matches = [item for item in result
                   if norm(item.get('display_name')) == name_key
                   and item.get('gender') == gender
                   and item.get('country_code') in allowed_countries]
        if len(matches) < 2:
            continue
        matches.sort(key=lambda item: (-len(item.get('results', [])), item['id']))
        primary = matches[0]
        for extra in matches[1:]:
            merge_profiles(primary, extra)
            result.remove(extra)
        canonical_code = override.get('canonical_country_code')
        if canonical_code:
            primary['country_code'] = canonical_code
        primary['identity_review_required'] = False

    # Rebuild review groups from the consolidated output. Profiles with a known
    # country are compared by country code or normalized country name; absent
    # country data remains reviewable when the other identity details match.
    review_groups = defaultdict(list)
    for swimmer in result:
        country_key = swimmer.get('country_code') or norm(swimmer.get('country')) or 'unknown-country'
        review_groups[(norm(swimmer.get('display_name')), country_key, swimmer.get('gender'))].append(swimmer)
    reviews = []
    for (_, country_key, gender), group in review_groups.items():
        if len(group) < 2:
            continue
        for swimmer in group:
            swimmer['identity_review_required'] = True
        reviews.append({'type':'same_name_uncertain_identity','name':group[0].get('display_name'),'country_key':country_key,'gender':gender,'swimmer_ids':[item['id'] for item in group],'reason':'Same normalized name, country and gender; age/team evidence does not identify a unique match.'})

    # Remove duplicate review case IDs and refresh all counts.
    result.sort(key=lambda item: (norm(item.get('display_name')), item.get('id','')))
    return result, reviews, merged_count

def main():
    data = json.loads(EXPORT.read_text())
    data['swimmers'], data['identity_review'], merges = consolidate(data.get('swimmers', []))
    preserved_aliases = sum(len(item.get('source_key_aliases', [])) for item in data['swimmers'])
    data['summary']['swimmers'] = len(data['swimmers'])
    data['summary']['individual_results'] = sum(item['result_count'] for item in data['swimmers'])
    data['summary']['identity_reviews'] = len(data['identity_review'])
    data['metadata']['identity_policy'] = 'One swimmer profile owns results across age groups; age group is stored on each result. Automatic merges use normalized name, country, gender, recognized national-team aliases and compatible birth-year ranges. Explicit user-confirmed identity overrides are also applied; remaining ambiguous identities stay separate for admin review.'
    data['metadata']['identity_consolidation'] = {'automatic_merges': max(merges, preserved_aliases), 'preserved_source_aliases': preserved_aliases, 'review_required_profiles': sum(bool(item.get('identity_review_required')) for item in data['swimmers'])}
    EXPORT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    summary_path = EXPORT.with_name('review-summary.json')
    if summary_path.exists():
        summary = json.loads(summary_path.read_text())
        summary['summary'] = data['summary']
        summary['metadata'] = data['metadata']
        summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'profiles':len(data['swimmers']),'automatic_merges':data['metadata']['identity_consolidation']['automatic_merges'],'identity_reviews':len(data['identity_review']),'review_required_profiles':data['metadata']['identity_consolidation']['review_required_profiles']}))

if __name__ == '__main__':
    main()
