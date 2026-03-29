import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { s } from "../styles";

interface Props {
  title: string;
  children: React.ReactNode;
}

export function GuideSection({ title, children }: Props) {
  return (
    <View>
      <Text style={s.h2}>{title}</Text>
      <View style={s.sectionRule} />
      {children}
    </View>
  );
}
