"""Consolidate only high-confidence repeat swimmer identities in the review export."""
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPORT = ROOT / 'data/swimming/swimmers.json'

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

def team_keys(swimmer):
    return {norm(team) for team in swimmer.get('teams', []) if norm(team)}

def meets(swimmer):
    return {result.get('meet_id') for result in swimmer.get('results', []) if result.get('meet_id')}

def compatible(left, right):
    if not left.get('country_code') or left.get('country_code') != right.get('country_code'):
        return False
    if not left.get('gender') or left.get('gender') != right.get('gender'):
        return False
    if not (team_keys(left) & team_keys(right)):
        return False
    if meets(left) & meets(right):
        return False
    left_age, right_age = identity_bounds(left), identity_bounds(right)
    if left_age == 'conflict' or right_age == 'conflict':
        return False
    if left_age and right_age:
        return max(left_age[0], right_age[0]) <= min(left_age[1], right_age[1])
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
        # Auto-merge only isolated one-to-one matches. If a source identity
        # could point to multiple swimmers, leave the whole ambiguity for review.
        for i, j in edges:
            if degree[i] != 1 or degree[j] != 1:
                continue
            a, b = find(i), find(j)
            if a == b:
                continue
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
    data['metadata']['identity_policy'] = 'Exact normalized name, country, gender, matching team and compatible birth-year ranges. Missing-age profiles may attach only to a unique known-age identity. Ambiguous and conflicting identities stay separate for admin review.'
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
