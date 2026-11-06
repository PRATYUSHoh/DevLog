import bcrypt from 'bcryptjs';

export async function validPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function genPassword(password: string): Promise<{ hash: string }> {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  return { hash };
}
