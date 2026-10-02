"""Parser regressions and integrity checks against the review artifact."""
import json
import unittest
import build_export as scraper

class ParserTests(unittest.TestCase):
    def setUp(self):
        scraper.OBS.clear();scraper.RELAYS.clear();scraper.ISSUES.clear()
        self.meta={'id':'fixture','url':'https://example.test/results.pdf'}
        self.meet={'group':'WTG','year':2023,'course':'LCM','meet_id':'wtg-2023'}

    def test_time_formats_and_invalid_seconds(self):
        self.assertEqual(scraper.time_ms('1:23.45'),83450)
        self.assertEqual(scraper.time_ms('01.23.45'),83450)
        self.assertIsNone(scraper.time_ms('1:75.00'))
        self.assertIsNone(scraper.time_ms('DQ'))

    def test_seed_is_not_finish(self):
        meet={**self.meet,'group':'USA'}
        scraper.parse_hytek(self.meta,meet,['Event 1 Men 30-39 50 Yard Freestyle\n1 John Smith  35  USA  26.40  25.12'])
        self.assertEqual(scraper.OBS[0]['time_ms'],25120)
        self.assertEqual(scraper.OBS[0]['seed_time_original'],'26.40')
        self.assertEqual(scraper.OBS[0]['course'],'SCY')

    def test_missing_team_is_not_nt(self):
        scraper.parse_hytek(self.meta,{**self.meet,'group':'USA'},['Event 1 Men 30-39 50 Yard Freestyle\n1 John Smith  NT  25.12'])
        self.assertEqual(scraper.OBS[0]['team_original'],'')
        self.assertIn('missing_team_check_source',scraper.OBS[0]['review_flags'])

    def test_identity_requires_compatible_country_and_age(self):
        ctx=scraper.event_context('Men 30-39 50m Freestyle')
        for team,age in [('USA',35),('USA',35),('CAN',35),('USA',50)]:
            scraper.emit(self.meta,self.meet,ctx,1,'source row','John Smith',team,'25.12',age=age)
        swimmers,reviews=scraper.group_swimmers(scraper.OBS)
        self.assertEqual(len(swimmers),3)
        self.assertEqual(sum(s['result_count'] for s in swimmers),3)
        self.assertTrue(reviews)

    def test_canadian_medley_and_gender_switch(self):
        scraper.parse_canada(self.meta,{**self.meet,'group':'Canada','year':2026},['FEMMES 200 m Medley\nKatie Sidmore  9/1/1987  TW_30  ON  3:13:06  Gold\nHOMMES 200 m libre\nJoe Hajj  4/13/1976  TM_50  QC  3:33:81  Gold'])
        self.assertEqual([(r['stroke'],r['gender']) for r in scraper.OBS],[('Individual Medley','Women'),('Freestyle','Men')])

    def test_team_headers_and_historical_misspelling(self):
        self.assertTrue(scraper.event_context('Mens Open 200m Freestyle Team')['is_relay'])
        self.assertEqual(scraper.event_context('25 m. Breastroke Single, Female Juniors 9-11')['stroke'],'Breaststroke')

class ExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.export=json.loads((scraper.DATA/'swimmers.json').read_text())

    def test_references_ids_and_summary(self):
        x=self.export
        swimmers={s['id'] for s in x['swimmers']}
        self.assertEqual(len(swimmers),len(x['swimmers']))
        results=[r for s in x['swimmers'] for r in s['results']]
        self.assertEqual(len({r['id'] for r in results}),len(results))
        self.assertEqual(len({r['id'] for r in x['relay_results']}),len(x['relay_results']))
        self.assertEqual(x['summary']['individual_results'],len(results))
        source_ids={s['id'] for s in x['sources']}
        for r in results+x['relay_results']:
            self.assertTrue(r['source_references'])
            for ref in r['source_references']:
                self.assertIn(ref['source_id'],source_ids)
                self.assertGreater(ref['page'],0)
            if r['race_status']!='OK':self.assertIsNone(r['time_ms'])
        for r in x['relay_results']:
            for m in r['members']:
                if m['swimmer_id']:self.assertIn(m['swimmer_id'],swimmers)
        self.assertEqual(len(x['source_groups']),7)
        self.assertFalse(x['metadata']['ready_for_database_import'])

    def test_swimming_only_and_age_placeholders(self):
        for sw in self.export['swimmers']:
            for r in sw['results']:
                self.assertFalse(r['is_relay'])
                if r['meet_id']=='wtg-2007':
                    for ref in r['source_references']:self.assertTrue(37<=ref['page']<=64)
                if r['meet_id']=='wtg-2019':self.assertIsNone(r['age_at_meet'])

if __name__=='__main__':unittest.main()
