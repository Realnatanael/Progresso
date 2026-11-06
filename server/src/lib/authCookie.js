import jwt from 'jsonwebtoken';

function baseCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setAuthCookie(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { ...baseCookie(), maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookie(res) {
  res.clearCookie('token', baseCookie());
}
