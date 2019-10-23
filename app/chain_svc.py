from collections import defaultdict

import yaml

from app.service.base_service import BaseService


class ChainService(BaseService):

    def __init__(self, services):
        self.log = self.add_service('chain_svc', self)
        self.data_svc = services.get('data_svc')

    async def persist_adversary(self, i, name, description, phases):
        """
        Save a new adversary from either the GUI or REST API. This writes a new YML file into the core data/ directory.
        :param i:
        :param name:
        :param description:
        :param phases:
        :return: the ID of the created adversary
        """
        _, file_path = await self.get_service('file_svc').find_file_path('%s.yml' % i, location='data')
        if not file_path:
            file_path = 'data/adversaries/%s.yml' % i
        with open(file_path, 'w+') as f:
            f.seek(0)
            p = defaultdict(list)
            for ability in phases:
                p[ability['phase']].append(ability['id'])
            f.write(yaml.dump(dict(id=i, name=name, description=description, phases=dict(p))))
            f.truncate()
        await self.data_svc.load_data('data')

    async def persist_ability(self, ability_id, file_contents):
        """
        Save a new ability from either the GUI or REST API. This updates an existing ability, if found, or writes
        a new YML file into the core data/ directory.
        :param ability_id:
        :param file_contents:
        :return:
        """
        _, file_path = await self.get_service('file_svc').find_file_path('%s.yml' % ability_id, location='data')
        if not file_path:
            file_path = 'data/abilities/all/%s.yml' % ability_id
        with open(file_path, 'w+') as f:
            f.seek(0)
            f.write(file_contents)
            f.truncate()
        await self.data_svc.load_data('data')
