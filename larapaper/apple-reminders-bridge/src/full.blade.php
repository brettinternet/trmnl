@php
    use Carbon\Carbon;

    $payload = data_get($data, 'data', $data);
    $settings = data_get($trmnl, 'plugin_settings.custom_fields_values', []);

    $tz = data_get($payload, 'timezone')
        ?? data_get($config, 'timezone')
        ?? data_get($settings, 'timezone')
        ?? 'America/Chicago';

    try {
        $now = Carbon::now($tz);
    } catch (\Throwable $e) {
        $tz = 'UTC';
        $now = Carbon::now($tz);
    }

    $view = strtolower((string) (data_get($payload, 'view')
        ?? data_get($config, 'reminder_view')
        ?? data_get($settings, 'reminder_view')
        ?? 'today'));

    $listName = data_get($payload, 'list')
        ?? data_get($config, 'list_name')
        ?? data_get($settings, 'list_name');

    $rawReminders = data_get($payload, 'reminders', []);
    $rawReminders = is_array($rawReminders) ? $rawReminders : [];

    $parseDue = function ($value) use ($tz) {
        if (! $value) {
            return null;
        }

        try {
            return Carbon::parse($value)->tz($tz);
        } catch (\Throwable $e) {
            return null;
        }
    };

    $reminders = collect($rawReminders)
        ->filter(fn ($reminder) => ! (bool) data_get($reminder, 'completed', false))
        ->map(function ($reminder) use ($parseDue) {
            $due = $parseDue(data_get($reminder, 'due_at'));

            return [
                'title' => trim((string) data_get($reminder, 'title', 'Untitled')) ?: 'Untitled',
                'notes' => trim((string) data_get($reminder, 'notes', '')),
                'list' => trim((string) data_get($reminder, 'list', '')),
                'due' => $due,
                'all_day' => (bool) data_get($reminder, 'all_day', false),
                'priority' => (int) data_get($reminder, 'priority', 0),
            ];
        })
        ->sort(function ($a, $b) {
            $aHasDue = $a['due'] !== null;
            $bHasDue = $b['due'] !== null;

            if ($aHasDue !== $bHasDue) {
                return $aHasDue ? -1 : 1;
            }

            if ($aHasDue && $bHasDue && $a['due']->timestamp !== $b['due']->timestamp) {
                return $a['due']->timestamp <=> $b['due']->timestamp;
            }

            if ($a['priority'] !== $b['priority']) {
                return $b['priority'] <=> $a['priority'];
            }

            return strcasecmp($a['title'], $b['title']);
        })
        ->values();

    $shownReminders = $reminders->take(10);
    $hiddenCount = max(0, $reminders->count() - $shownReminders->count());

    $viewLabel = match ($view) {
        'scheduled' => 'Scheduled',
        'list' => $listName ? (string) $listName : 'List',
        default => 'Today',
    };

    $dueLabel = function ($reminder) use ($now) {
        if (! $reminder['due']) {
            return 'No date';
        }

        if ($reminder['all_day']) {
            return $reminder['due']->isSameDay($now)
                ? 'Today'
                : $reminder['due']->format('M j');
        }

        if ($reminder['due']->isSameDay($now)) {
            return $reminder['due']->format('g:i A');
        }

        return $reminder['due']->format('M j, g:i A');
    };

    $dueClass = function ($reminder) use ($now) {
        if (! $reminder['due']) {
            return 'text--gray-40';
        }

        if ($reminder['due']->lt($now) && ! $reminder['due']->isSameDay($now)) {
            return 'text--black';
        }

        return 'text--gray-40';
    };
@endphp

@props(['size' => 'full'])

<x-trmnl::view size="{{ $size }}">
    <x-trmnl::layout class="layout--col layout--top p--3 gap--small">
        <div class="flex flex--between w--full mb--2">
            <div class="flex flex--col gap--none">
                <span class="value--small">Reminders</span>
                <span class="label--small text--gray-40">{{ $viewLabel }} · {{ $now->format('M j') }}</span>
            </div>
            <div class="value--small value--tnums">{{ $reminders->count() }}</div>
        </div>

        @if($shownReminders->isEmpty())
            <div class="w--full h--full flex flex--col flex--center-y flex--center-x text--center py--8">
                <span class="value--xxsmall">No reminders</span>
                <span class="label--small text--gray-40">{{ $viewLabel }}</span>
            </div>
        @else
            <div class="flex flex--col gap--xsmall w--full">
                @foreach($shownReminders as $reminder)
                    <div class="border--h-6 rounded--small px--2 py--1">
                        <div class="flex flex--between flex--row gap--small w--full">
                            <span class="value--xxsmall">
                                {{ Str::limit($reminder['title'], 48) }}
                            </span>
                            <span class="label--small value--tnums {{ $dueClass($reminder) }}">
                                {{ $dueLabel($reminder) }}
                            </span>
                        </div>

                        @if($reminder['list'] || $reminder['notes'])
                            <div class="label--small text--gray-40">
                                @if($reminder['list'])
                                    {{ $reminder['list'] }}
                                @endif
                                @if($reminder['list'] && $reminder['notes'])
                                    ·
                                @endif
                                @if($reminder['notes'])
                                    {{ Str::limit(str_replace(["\r", "\n"], ' ', $reminder['notes']), 58) }}
                                @endif
                            </div>
                        @endif
                    </div>
                @endforeach
            </div>

            @if($hiddenCount > 0)
                <div class="label--small text--gray-40 text--center w--full pt--1">
                    +{{ $hiddenCount }} more
                </div>
            @endif
        @endif
    </x-trmnl::layout>
</x-trmnl::view>
