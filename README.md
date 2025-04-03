# MikroAuth client library

A client-side library for the [MikroAuth magic link authentication service](https://github.com/mikaelvesavuori/mikroauth). You will have to point the client to the endpoint of your MikroAuth server.

The minified version is ~4KB, substantially smaller than clients for common authentication services like Firebase (~118KB).

## Quick Start

In your HTML:

```html
<script src="path/to/mikroauth-client.min.js"></script>
<script>
  const auth = new MikroAuthClient({ authUrl: 'https://auth.example.com' });

  const isAuthenticated = await auth.isAuthenticated();
  console.log('Is authenticated?', isAuthenticated);

  const userInfo = await auth.getUserInfo();
  console.log('User info:', userInfo);
</script>
```

## API Reference

### requestMagicLink

```js
await auth.requestMagicLink(email);
```

Request a new magic link email to the specified email address.

### handleMagicLink

```js
await auth.handleMagicLink();
```

Handle magic link from URL. Used when verifying the URL params (token and email).

### isAuthenticated

```js
await auth.isAuthenticated();
```

Checks if the user is authenticated.

### getUserInfo

```js
await auth.getUserInfo();
```

Retrieves user data.

### refreshToken

```js
await auth.refreshToken();
```

Get a new refresh token.

### logout

```js
await auth.logout();
```

Log out (sign out) the user.

## Development

### Build

Run `npm run build`. Files are created in the `lib` directory.

### Test

Run `npm test`.

## License

MIT. See the `LICENSE` file.
