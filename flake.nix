{
  description = "MagicAuth SDK - Legacy JavaScript authentication SDK";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            sqlite
          ];

          shellHook = ''
            export PS1="\[\e[1;32m\](flake-env)\[\e[0m\] \[\e[1;34m\]\u@\h:\w\[\e[0m\]$ "
          '';
        };
      }
    );
}
