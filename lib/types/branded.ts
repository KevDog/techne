/**
 * Branded ID types — opt-in for new code to prevent mixing up
 * IDs of different entities (e.g. passing a showId where a deptId
 * is expected). Existing string-typed fields remain string; this
 * module is here so new APIs can adopt branded IDs incrementally.
 *
 * Usage:
 *   function deleteShow(id: ShowId) { ... }
 *   deleteShow(asShowId(rawString))      // OK
 *   deleteShow(asDeptId(rawString))      // type error
 */

declare const __brand: unique symbol
export type Brand<T, B> = T & { readonly [__brand]: B }

export type OrgId = Brand<string, 'OrgId'>
export type ShowId = Brand<string, 'ShowId'>
export type SeasonId = Brand<string, 'SeasonId'>
export type DeptId = Brand<string, 'DeptId'>
export type MaterialId = Brand<string, 'MaterialId'>
export type NoteId = Brand<string, 'NoteId'>
export type MeetingId = Brand<string, 'MeetingId'>
export type UserId = Brand<string, 'UserId'>

export const asOrgId = (id: string): OrgId => id as OrgId
export const asShowId = (id: string): ShowId => id as ShowId
export const asSeasonId = (id: string): SeasonId => id as SeasonId
export const asDeptId = (id: string): DeptId => id as DeptId
export const asMaterialId = (id: string): MaterialId => id as MaterialId
export const asNoteId = (id: string): NoteId => id as NoteId
export const asMeetingId = (id: string): MeetingId => id as MeetingId
export const asUserId = (id: string): UserId => id as UserId
