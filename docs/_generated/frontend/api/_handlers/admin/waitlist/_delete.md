[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/admin/waitlist/\_delete

# api/\_handlers/admin/waitlist/\_delete

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/admin/waitlist/\_delete.ts:42](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/admin/waitlist/_delete.ts#L42)

DELETE a waitlist profile by id.

Use this to remove duplicate/orphan profiles (e.g. synthetic-email profiles
created by the auth bridge that were superseded by a real signup).

Admin-only. Permanently deletes the row and any associated referral data.

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
