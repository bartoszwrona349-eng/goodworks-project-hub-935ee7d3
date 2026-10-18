CREATE OR REPLACE FUNCTION public.check_booking_overlap()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if new.status = 'approved' and exists (
    select 1 from public.bookings b where b.venue_id=new.venue_id and b.id<>new.id and b.status='approved'
      and b.start_at < new.end_at and b.end_at > new.start_at) then
    raise exception 'Wybrany termin jest już zajęty';
  end if;
  if new.status = 'pending' and exists (
    select 1 from public.bookings b where b.venue_id=new.venue_id and b.id<>new.id and b.status='approved'
      and b.start_at < new.end_at and b.end_at > new.start_at) then
    raise exception 'Wybrany termin jest już zajęty';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.get_busy_slots(_from timestamp with time zone, _to timestamp with time zone)
 RETURNS TABLE(id uuid, venue_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, is_mine boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select b.id, b.venue_id, b.start_at, b.end_at, (b.user_id = auth.uid()) as is_mine
  from public.bookings b
  where b.start_at < _to and b.end_at > _from
    and (b.status = 'approved' or (b.status = 'pending' and b.user_id = auth.uid()))
$function$;