"""Bootstrap Hui deployment defaults."""

from django.core.management.base import BaseCommand

from InvenTree.hui import bootstrap_hui


class Command(BaseCommand):
    """Create Hui-specific default templates and user groups."""

    help = 'Bootstrap Hui deployment defaults'

    def add_arguments(self, parser):
        """Add optional command arguments."""
        parser.add_argument(
            '--force',
            action='store_true',
            help='Re-apply defaults to existing templates and groups',
        )

    def handle(self, *args, **options):
        """Execute the Hui bootstrap routine."""
        summary = bootstrap_hui(force=options['force'])
        self.stdout.write(self.style.SUCCESS(summary.describe()))
        return 'done'
