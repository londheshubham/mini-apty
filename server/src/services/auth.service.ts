import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { AppDataSource } from "../config/datasource";
import { User } from "../entities/User";
import { AppError } from "../errors/AppError";

const userRepository = AppDataSource.getRepository(User);

export const signupService = async (email: string, password: string) => {
  const existingUser = await userRepository.findOne({
    where: {
      email,
    },
  });

  if (existingUser) {
    throw new AppError(409, "EMAIL_EXISTS", "Email already exists");
  }

  const salt = await bcrypt.genSalt(10);

  const passwordHash = await bcrypt.hash(password, salt);

  const user = userRepository.create({
    email,
    passwordHash,
  });

  const savedUser = await userRepository.save(user);

  return {
    id: savedUser.id,
    email: savedUser.email,
  };
};

export const loginService = async (email: string, password: string) => {
  const user = await userRepository.findOne({
    where: {
      email,
    },
  });

  if (!user) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }

  const token = jwt.sign(
    {
      userId: user.id,
    },
    jwtSecret,
    {
      expiresIn: "7d",
    },
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
    },
  };
};
