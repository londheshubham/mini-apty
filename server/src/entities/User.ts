import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";

import { Walkthrough } from "./Walkthrough";

@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @OneToMany(() => Walkthrough, (walkthrough) => walkthrough.owner)
  walkthroughs!: Walkthrough[];
}
