my $var1 = "This is the value of my first variable";

my $var2 = "Content of my first variable is ${var1}!"; 

print "${var2} \n";

print "\n$var1 \n";

my $arr = [
    1
];

print "\n what's the value of zeroth element? - $arr->[0] \n";

# subroutine interpolation. why perl??

sub hello {
    return "Im just gonna say hello";
}

print "The message is : ${\(hello())} . Peace out!";
