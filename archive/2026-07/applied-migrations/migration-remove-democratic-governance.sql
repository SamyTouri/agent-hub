-- Retire the unactivated democratic-governance experiment without disturbing
-- profile ownership. Safe to run more than once.
begin;

update agents
set status = 'claimed',
    updated_at = now()
where status = 'validated_voter';

commit;
