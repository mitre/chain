from collections import defaultdict

import yaml


class ChainService:

    def __init__(self, services):
        self.services = services

    async def persist_adversary(self, i, name, description, phases):
        """
        Save a new adversary from either the GUI or REST API. This writes a new YML file into the core data/ directory.
        :param i:
        :param name:
        :param description:
        :param phases:
        :return: the ID of the created adversary
        """
        _, file_path = await self.services.get('file_svc').find_file_path('%s.yml' % i, location='data')
        if not file_path:
            file_path = 'data/adversaries/%s.yml' % i
        with open(file_path, 'w+') as f:
            f.seek(0)
            p = defaultdict(list)
            for ability in phases:
                p[ability['phase']].append(ability['id'])
            f.write(yaml.dump(dict(id=i, name=name, description=description, phases=dict(p))))
            f.truncate()
        await self.services.get('data_svc').load_data('data')
