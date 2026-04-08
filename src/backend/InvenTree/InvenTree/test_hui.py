"""Tests for Hui deployment bootstrap."""

from django.contrib.auth.models import Group
from django.contrib.contenttypes.models import ContentType
from django.core.management import call_command
from django.test import TestCase

from common.models import ParameterTemplate
from InvenTree.hui import HUI_PARAMETER_TEMPLATES, bootstrap_hui
from users.models import RuleSet
from users.ruleset import RULESET_NAMES, RuleSetEnum


class HuiBootstrapTests(TestCase):
    """Test Hui bootstrap behavior."""

    def test_hui_bootstrap_command_creates_defaults(self):
        """Ensure the management command creates Hui defaults."""
        output = call_command('hui_bootstrap', verbosity=0)
        self.assertEqual(output, 'done')

        part_content_type = ContentType.objects.get(app_label='part', model='part')
        template_names = [template['name'] for template in HUI_PARAMETER_TEMPLATES]

        self.assertEqual(
            ParameterTemplate.objects.filter(name__in=template_names).count(),
            len(template_names),
        )

        for template in ParameterTemplate.objects.filter(name__in=template_names):
            self.assertEqual(template.model_type, part_content_type)
            self.assertTrue(template.enabled)

        warehouse_group = Group.objects.get(name='仓储人员')
        employee_group = Group.objects.get(name='普通员工')

        self.assertEqual(
            RuleSet.objects.filter(group=warehouse_group).count(),
            len(RULESET_NAMES),
        )
        self.assertEqual(
            RuleSet.objects.filter(group=employee_group).count(),
            len(RULESET_NAMES),
        )

        warehouse_part_rule = RuleSet.objects.get(
            group=warehouse_group, name=RuleSetEnum.PART
        )
        self.assertTrue(warehouse_part_rule.can_view)
        self.assertTrue(warehouse_part_rule.can_add)
        self.assertTrue(warehouse_part_rule.can_change)
        self.assertFalse(warehouse_part_rule.can_delete)

        employee_stock_rule = RuleSet.objects.get(
            group=employee_group, name=RuleSetEnum.STOCK
        )
        self.assertTrue(employee_stock_rule.can_view)
        self.assertFalse(employee_stock_rule.can_add)
        self.assertFalse(employee_stock_rule.can_change)
        self.assertFalse(employee_stock_rule.can_delete)

    def test_hui_bootstrap_is_idempotent(self):
        """Ensure repeated bootstrap runs do not duplicate defaults."""
        first = bootstrap_hui()
        second = bootstrap_hui()

        self.assertTrue(first.changed)
        self.assertFalse(second.changed)

        template_names = [template['name'] for template in HUI_PARAMETER_TEMPLATES]

        self.assertEqual(
            ParameterTemplate.objects.filter(name__in=template_names).count(),
            len(template_names),
        )
        self.assertEqual(Group.objects.filter(name='仓储人员').count(), 1)
        self.assertEqual(Group.objects.filter(name='普通员工').count(), 1)
