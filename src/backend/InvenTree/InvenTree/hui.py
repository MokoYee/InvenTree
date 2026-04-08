"""Bootstrap helpers for the Hui deployment profile."""

from dataclasses import dataclass

from django.contrib.auth.models import Group
from django.contrib.contenttypes.models import ContentType

import structlog

from common.models import ParameterTemplate
from users.models import RuleSet
from users.ruleset import RuleSetEnum
from users.tasks import update_group_roles

logger = structlog.get_logger('inventree')


HUI_PARAMETER_TEMPLATES = (
    {
        'name': '样品初次到店时间',
        'description': '记录样品第一次到店时间，建议使用 YYYY-MM-DD',
    },
    {
        'name': '销售单价',
        'description': '记录当前销售参考单价，建议填写数字，单位默认按元理解',
    },
    {
        'name': '抖店上架数量',
        'description': '记录当前抖店上架数量',
    },
    {
        'name': '视频号上架数量',
        'description': '记录当前视频号上架数量',
    },
)

HUI_GROUP_RULESETS = {
    '仓储人员': {
        RuleSetEnum.PART_CATEGORY: {'can_view': True},
        RuleSetEnum.PART: {'can_view': True, 'can_add': True, 'can_change': True},
        RuleSetEnum.STOCK_LOCATION: {
            'can_view': True,
            'can_add': True,
            'can_change': True,
        },
        RuleSetEnum.STOCK: {'can_view': True, 'can_add': True, 'can_change': True},
    },
    '普通员工': {
        RuleSetEnum.PART_CATEGORY: {'can_view': True},
        RuleSetEnum.PART: {'can_view': True},
        RuleSetEnum.STOCK_LOCATION: {'can_view': True},
        RuleSetEnum.STOCK: {'can_view': True},
    },
}


@dataclass
class HuiBootstrapSummary:
    """Result summary for Hui bootstrap execution."""

    created_templates: int = 0
    updated_templates: int = 0
    created_groups: int = 0
    configured_groups: int = 0
    skipped_templates: int = 0
    skipped_groups: int = 0

    @property
    def changed(self) -> bool:
        """Return True if bootstrap changed any database rows."""
        return any(
            [
                self.created_templates,
                self.updated_templates,
                self.created_groups,
                self.configured_groups,
            ]
        )

    def describe(self) -> str:
        """Return a short human-readable summary."""
        return (
            'templates(created={created}, updated={updated}, skipped={skipped_templates}), '
            'groups(created={groups_created}, configured={groups_configured}, skipped={skipped_groups})'
        ).format(
            created=self.created_templates,
            updated=self.updated_templates,
            skipped_templates=self.skipped_templates,
            groups_created=self.created_groups,
            groups_configured=self.configured_groups,
            skipped_groups=self.skipped_groups,
        )


def normalize_rule_options(options: dict) -> dict[str, bool]:
    """Normalize ruleset flags to match RuleSet.save behavior."""
    can_delete = bool(options.get('can_delete', False))
    can_add = bool(options.get('can_add', False))
    can_change = bool(options.get('can_change', False) or can_add or can_delete)
    can_view = bool(
        options.get('can_view', False) or can_change or can_add or can_delete
    )

    return {
        'can_view': can_view,
        'can_add': can_add,
        'can_change': can_change,
        'can_delete': can_delete,
    }


def bootstrap_hui(force: bool = False) -> HuiBootstrapSummary:
    """Create Hui-specific defaults for a fresh deployment."""
    summary = HuiBootstrapSummary()
    part_content_type = ContentType.objects.get(app_label='part', model='part')

    for template_data in HUI_PARAMETER_TEMPLATES:
        summary = ensure_parameter_template(
            summary=summary,
            part_content_type=part_content_type,
            force=force,
            **template_data,
        )

    for group_name, ruleset_config in HUI_GROUP_RULESETS.items():
        group, created = Group.objects.get_or_create(name=group_name)

        if created:
            summary.created_groups += 1

        # 仅在首次创建或显式 force 时写入默认权限，避免覆盖已上线实例的人工调整。
        if created or force:
            apply_group_ruleset_profile(group, ruleset_config)
            summary.configured_groups += 1
        else:
            summary.skipped_groups += 1

    logger.info('Hui bootstrap completed: %s', summary.describe())
    return summary


def ensure_parameter_template(
    summary: HuiBootstrapSummary,
    name: str,
    description: str,
    part_content_type: ContentType,
    force: bool = False,
) -> HuiBootstrapSummary:
    """Ensure a Hui parameter template exists."""
    template = ParameterTemplate.objects.filter(name__iexact=name).first()

    defaults = {
        'name': name,
        'description': description,
        'model_type': part_content_type,
        'enabled': True,
    }

    if template is None:
        ParameterTemplate.objects.create(**defaults)
        summary.created_templates += 1
        return summary

    # 仅在显式 force 时才回填说明和模型归属，避免覆盖已录入的业务习惯。
    if force:
        updated_fields = []

        for field, value in defaults.items():
            if getattr(template, field) != value:
                setattr(template, field, value)
                updated_fields.append(field)

        if updated_fields:
            template.save(update_fields=updated_fields)
            summary.updated_templates += 1
            return summary

    summary.skipped_templates += 1
    return summary


def apply_group_ruleset_profile(group: Group, ruleset_config: dict) -> None:
    """Apply the Hui ruleset profile to a group."""
    update_group_roles(group)

    RuleSet.objects.filter(group=group).update(
        can_view=False,
        can_add=False,
        can_change=False,
        can_delete=False,
    )

    for ruleset_name, options in ruleset_config.items():
        RuleSet.objects.filter(group=group, name=ruleset_name).update(
            **normalize_rule_options(options)
        )

    update_group_roles(group)
