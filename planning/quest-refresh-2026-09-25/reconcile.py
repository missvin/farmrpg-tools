"""Offline, idempotent promotion of reviewed September quest evidence.

Run from the repository root after preserving the personal snapshot in local-data.
Browser evidence contains only public Buddy pages; personal history stays ignored.
"""
import csv
import io
import json
import re
from pathlib import Path

BASE = Path('planning/quest-refresh-2026-09-25')
LOCAL = Path('local-data/quests-2026-09-25')


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def key(value):
    return re.sub(r'\s+', ' ', value.translate(str.maketrans('‘’‚‛′“”„‟″', "'''''\"\"\"\"\""))).strip().lower()


def csv_rows(path):
    return list(csv.DictReader(path.open(encoding='utf-8-sig', newline='')))


def write_csv(path, rows):
    with path.open('w', encoding='utf-8', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]), lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)


def patch_csv(path, original, rows, identity):
    """Keep untouched lines byte-identical; replace only changed rows and append new ones."""
    new = {r[identity]: r for r in rows}
    fields = list(original[0])
    def encode(row):
        out = io.StringIO(newline='')
        csv.DictWriter(out, fieldnames=fields, lineterminator='\n').writerow(row)
        return out.getvalue()
    lines = path.read_text(encoding='utf-8').splitlines(keepends=True)
    output = [lines[0]]
    seen = set()
    for line, row in zip(lines[1:], original, strict=True):
        ident = row[identity]
        replacement = new.get(ident)
        if replacement is not None:
            output.append(line if replacement == row else encode(replacement))
            seen.add(ident)
    output.extend(encode(r) for r in rows if r[identity] not in seen)
    path.write_text(''.join(output), encoding='utf-8', newline='')


snapshot = read_json(LOCAL / 'snapshot.json')
assert len(snapshot['completedRequests']) == snapshot['summary']['reportedCompletedCount'] == 2403
assert not snapshot['warnings']
personal = {r['questKey']: r for r in snapshot['completedRequests']}
assert len(personal) == 2403
paths = {name: Path('data') / f'quest_{name}.csv' for name in ('catalog', 'requirements', 'rewards')}
original = {name: csv_rows(path) for name, path in paths.items()}
data = {name: [dict(r) for r in rows] for name, rows in original.items()}

# HTML line-break markup is not part of the three public frog quest titles.
renames = {r['quest_key']: key(re.sub(r'<br\s*/?>', ' ', r['quest_name'], flags=re.I))
           for r in data['catalog'] if '<br' in r['quest_name'].lower()}
for kind, rows in data.items():
    for row in rows:
        row['quest_key'] = renames.get(row['quest_key'], row['quest_key'])
        if kind == 'catalog':
            for field in ('quest_name', 'questline_name'):
                row[field] = re.sub(r'<br\s*/?>', ' ', row[field], flags=re.I)
            row['questline_key'] = key(row['questline_name'])
            row['previous_quest_key'] = renames.get(row['previous_quest_key'], row['previous_quest_key'])
            row['next_quest_keys'] = '; '.join(renames.get(x.strip(), x.strip()) for x in row['next_quest_keys'].split(';') if x.strip())

catalog = {r['quest_key']: r for r in data['catalog']}
pages = read_json(BASE / 'buddy-pages.json')
pj_pages = read_json(BASE / 'pumpkin-juice-pages.json')
discovery = read_json(BASE / 'buddy-discovery.json')
families = {d['query']: d['links'][0][0].replace('\nQuestline', '')
            for d in read_json(BASE / 'buddy-questlines.json') if len(d['links']) == 1}
page_family = {url: families[d['name']] for d in discovery if d['name'] in families for _, url in d['links']}
added = []


def page_row(page):
    name = page['name']
    assert name and name != 'Page not found'
    text = page['text']
    url = 'https://buddy.farm' + page['url']
    quest_key = key(name)
    row = dict.fromkeys(original['catalog'][0], '')
    family = page_family.get(page['url'], name)
    row.update(quest_key=quest_key, quest_name=name, questline_key=key(family), questline_name=family,
               npc=personal.get(quest_key, {}).get('npc') or '', source_url=url, coverage_status='reviewed',
               notes='BL-341: visible Buddy quest page reviewed 2026-09-25; public evidence in planning/quest-refresh-2026-09-25/buddy-pages.json.')
    if family == name:
        row['notes'] += ' Questline grouping not established; retained as a singleton.'
    stage = re.search(r' ([IVXLCDM]+)$', name)
    row['stage_label'] = stage.group(1) if stage else ''
    for label in ('Farming', 'Fishing', 'Crafting', 'Exploring', 'Tower'):
        found = re.search(r'(?:^|\n)' + label + r' Level\n([\d,]+)(?:\n|$)', text)
        row[label.lower() + '_level'] = found.group(1).replace(',', '') if found else ''
    for label in ('Available From', 'Available To'):
        found = re.search(r'(?:^|\n)' + label + r'\n([^\n]+)', text)
        if found:
            row['notes'] += f' {label}: {found.group(1)}.'
    for link in page['links']:
        if link['url'] and link['url'].startswith('/q/'):
            if link['name'].startswith('Previous\n'):
                row['previous_quest_key'] = key(link['name'].split('\n', 1)[1])
            elif link['name'].startswith('Next\n'):
                row['next_quest_keys'] = '; '.join(filter(None, [row['next_quest_keys'], key(link['name'].split('\n', 1)[1])]))
    return row


for page in pages:
    row = page_row(page)
    quest_key = row['quest_key']
    if quest_key in catalog:
        continue
    catalog[quest_key] = row
    data['catalog'].append(row)
    added.append(quest_key)
    for kind, heading, type_field in [('requirements', 'Request', 'requirement_type'), ('rewards', 'Reward', 'reward_type')]:
        section = re.search(r'(?:^|\n)' + heading + r'\n(.*?)(?=\nReward\n|\nNavigated to |$)', page['text'], re.S)
        if not section:
            continue
        lines = section.group(1).strip().splitlines()
        assert len(lines) % 2 == 0, (page['name'], heading, lines)
        linked_items = {link['name'].split('\n')[0] for link in page['links'] if (link['url'] or '').startswith('/i/')}
        for name, quantity in zip(lines[::2], lines[1::2]):
            assert re.fullmatch(r'[\d,]+', quantity), (page['name'], name, quantity)
            if name not in linked_items:
                row['notes'] += f' {heading} non-item: {name} {quantity}.'
                continue
            item = dict.fromkeys(original[kind][0], '')
            item.update(quest_key=quest_key, item_name=name, canonical_key=key(name), quantity=quantity.replace(',', ''),
                        source_url=row['source_url'], notes='BL-341: visible Buddy page reviewed 2026-09-25.')
            item[type_field] = 'item'
            data[kind].append(item)

# Required partial placeholders: no invented rewards, dates, gates, or chain links.
for observed in [*snapshot['completedRequests'], *snapshot['activeRequests']]:
    if observed['questKey'] in catalog:
        continue
    row = dict.fromkeys(original['catalog'][0], '')
    row.update(quest_key=observed['questKey'], quest_name=observed['questName'],
               questline_key=observed['questKey'], questline_name=observed['questName'], npc=observed['npc'] or '',
               source_url='user:help-needed-paste:2026-09-25', coverage_status='partial',
               notes='BL-341 placeholder: observed in user FarmRPG paste 2026-09-25; Buddy search returned no matching quest; requirements, rewards, gates, availability and questline unknown. Personal completion details retained only in ignored local-data.')
    catalog[row['quest_key']] = row
    data['catalog'].append(row)
    added.append(row['quest_key'])

# Enrich the eight known missed PJ quests with directly reviewed gates and links.
for page in pj_pages:
    verified = page_row(page)
    row = catalog[verified['quest_key']]
    for field in ('farming_level', 'fishing_level', 'crafting_level', 'exploring_level', 'tower_level', 'previous_quest_key', 'next_quest_keys'):
        if verified[field]:
            row[field] = verified[field]
    note = ' BL-341: gates, links and availability reviewed 2026-09-25 in pumpkin-juice-pages.json.'
    if note not in row['notes']:
        row['notes'] += note
        for match in re.finditer(r'Available (From|To)\n([^\n]+)', page['text']):
            row['notes'] += f' Available {match.group(1)}: {match.group(2)}.'

assert len(catalog) == len(data['catalog'])
assert all(r['questKey'] in catalog for r in snapshot['completedRequests'])
for name in ('requirements', 'rewards'):
    assert all(r['quest_key'] in catalog for r in data[name])
    identities = [(r['quest_key'], r['canonical_key']) for r in data[name]]
    assert len(identities) == len(set(identities))

for name, path in paths.items():
    if name == 'catalog':
        patch_csv(path, original[name], data[name], 'quest_key')
    else:
        # Preserve original text while updating only the three markup-based keys.
        text = path.read_text(encoding='utf-8')
        for old, new in renames.items():
            text = text.replace(old, new)
        new_rows = data[name][len(original[name]):]
        out = io.StringIO(newline='')
        csv.DictWriter(out, fieldnames=list(original[name][0]), lineterminator='\n').writerows(new_rows)
        path.write_text(text.rstrip('\n') + '\n' + out.getvalue(), encoding='utf-8', newline='')

write_csv(LOCAL / 'completed-quests.csv', [dict(**r, observedOn='2026-09-25') for r in snapshot['completedRequests']])
write_csv(LOCAL / 'rarest-quests.csv', sorted(snapshot['completedRequests'], key=lambda r: (r['playerCount'], r['questName']))[:10])
if added:
    write_csv(BASE / 'quest-review.csv', [dict(quest_key=r['quest_key'], quest_name=r['quest_name'], coverage_status=r['coverage_status'], source_url=r['source_url']) for r in data['catalog'] if r['quest_key'] in added])
missed = [r for r in data['rewards'] if r['canonical_key'] == 'pumpkin juice' and r['quest_key'] not in personal]
write_csv(LOCAL / 'missed-pumpkin-juice.csv', [dict(quest_name=catalog[r['quest_key']]['quest_name'], quantity=r['quantity'], tower_level=catalog[r['quest_key']]['tower_level'], source_url=catalog[r['quest_key']]['source_url']) for r in missed])
print(json.dumps(dict(completed=len(personal), added=len(added), reviewed=sum(catalog[k]['coverage_status']=='reviewed' for k in added), placeholders=sum(catalog[k]['coverage_status']=='partial' for k in added), corrected_markup=len(renames), requirements_added=len(data['requirements'])-len(original['requirements']), rewards_added=len(data['rewards'])-len(original['rewards']), missed_pj=len(missed))))
